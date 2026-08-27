const TERMINAL_STATES = new Set(["STOPPED", "FAILED"]);

function makeError(code, message, cause) {
	const error = new Error(message, cause ? { cause } : undefined);
	error.code = code;
	return error;
}

function serializeError(error) {
	if (!error) return null;
	return {
		name: error.name ?? "Error",
		message: String(error.message ?? error),
		code: error.code ?? "UNSPECIFIED"
	};
}

function freezeSnapshot(value) {
	if (value && typeof value === "object") {
		Object.freeze(value);
		for (const child of Object.values(value)) freezeSnapshot(child);
	}
	return value;
}

function defaultDeadline(callback, milliseconds) {
	const handle = setTimeout(callback, milliseconds);
	return { cancel: () => clearTimeout(handle) };
}

export function createWorkbenchLifecycle(options = {}) {
	const resources = Array.from(options.resources ?? []);
	const cleanupTimeoutMs = options.cleanupTimeoutMs ?? 1000;
	const deadline = options.deadline ?? { schedule: defaultDeadline };
	const emit = typeof options.emit === "function" ? options.emit : null;
	const records = [];
	const resourceStack = [];
	let state = "CREATED";
	let startPromise;
	let disposePromise;
	let cleanupPromise;
	let stopRequested = false;
	let startupError = null;
	let cleanupErrors = [];
	let cleanupComplete = false;
	let cleanupTimedOut = false;
	let deadlineHandle = null;
	const instanceId = `workbench-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

	function record(operation, from, to, result, errorCode = null) {
		const entry = {
			instance_id: instanceId,
			operation,
			from,
			to,
			result,
			error_code: errorCode,
			duration_ms: 0,
			cleanup_complete: cleanupComplete,
			remaining_resource_count: resourceStack.filter(resource => resource.active).length
		};
		records.push(entry);
		if (emit) emit({ ...entry });
	}

	function transition(next, operation, result = "ok", errorCode = null) {
		const previous = state;
		state = next;
		record(operation, previous, next, result, errorCode);
	}

	function snapshot() {
		const value = {
			instance_id: instanceId,
			state,
			startup_error: startupError,
			cleanup_errors: cleanupErrors.slice(),
			cleanup_complete: cleanupComplete,
			cleanup_timed_out: cleanupTimedOut,
			remaining_resource_count: resourceStack.filter(resource => resource.active).length,
			records: records.map(entry => ({ ...entry }))
		};
		return freezeSnapshot(value);
	}

	function terminalError() {
		return makeError("LIFECYCLE_TERMINAL", `Lifecycle is already terminal: ${state}`);
	}

	async function drainCleanup() {
		while (resourceStack.some(resource => resource.active && !resource.cleaning && !resource.attempted)) {
			const resource = [...resourceStack].reverse().find(item => item.active && !item.cleaning && !item.attempted);
			if (!resource) break;
			resource.cleaning = true;
			resource.attempted = true;
			try {
				await Promise.resolve(resource.disposer());
				resource.active = false;
			} catch (error) {
				cleanupErrors.push(serializeError(error));
			} finally {
				resource.cleaning = false;
			}
		}
	}

	function observeLateCleanup() {
		for (const resource of resourceStack.filter(item => item.active && !item.cleaning && !item.attempted)) {
			resource.cleaning = true;
			resource.attempted = true;
			Promise.resolve()
				.then(() => resource.disposer())
				.then(() => { resource.active = false; })
				.catch(error => { cleanupErrors.push(serializeError(error)); })
				.finally(() => { resource.cleaning = false; });
		}
	}

	async function runCleanup(failureMode = false) {
		if (cleanupPromise) return cleanupPromise;
		if (state !== "STOPPING") transition("STOPPING", "dispose", "started");
		cleanupComplete = false;
		cleanupErrors = [];
		let timeoutResolve;
		const timeoutPromise = new Promise(resolve => { timeoutResolve = resolve; });
		deadlineHandle = deadline.schedule(() => {
			cleanupTimedOut = true;
			timeoutResolve();
		}, cleanupTimeoutMs);

		const drainPromise = drainCleanup();
		drainPromise.catch(() => {});
		cleanupPromise = (async () => {
			const completed = await Promise.race([
				drainPromise.then(() => true),
				timeoutPromise.then(() => false)
			]);
			if (!completed) {
				observeLateCleanup();
				cleanupComplete = false;
				transition("FAILED", "dispose", "timeout", "LIFECYCLE_CLEANUP_TIMEOUT");
				throw makeError("LIFECYCLE_CLEANUP_TIMEOUT", "Lifecycle cleanup exceeded deadline");
			}
			if (deadlineHandle?.cancel) deadlineHandle.cancel();
			deadlineHandle = null;
			cleanupComplete = resourceStack.every(resource => !resource.active);
			if (cleanupErrors.length > 0) {
				transition("FAILED", "dispose", "failed", "LIFECYCLE_CLEANUP_FAILED");
				throw makeError("LIFECYCLE_CLEANUP_FAILED", "Lifecycle cleanup failed");
			}
			if (failureMode) {
				transition("FAILED", "rollback", "failed", "LIFECYCLE_START_FAILED");
				return snapshot();
			}
			transition("STOPPED", "dispose", "ok");
			return snapshot();
		})();
		return cleanupPromise;
	}

	async function runStart() {
		transition("STARTING", "start", "started");
		try {
			for (const acquire of resources) {
				if (stopRequested) throw makeError("LIFECYCLE_STOP_REQUESTED", "Lifecycle stop requested during startup");
				const disposer = await acquire();
				if (typeof disposer !== "function") {
					throw makeError("LIFECYCLE_INVALID_DISPOSER", "Resource acquire must return a disposer function");
				}
				resourceStack.push({ disposer, active: true, cleaning: false });
				if (stopRequested) throw makeError("LIFECYCLE_STOP_REQUESTED", "Lifecycle stop requested during startup");
			}
			if (stopRequested) throw makeError("LIFECYCLE_STOP_REQUESTED", "Lifecycle stop requested during startup");
			transition("RUNNING", "start", "ok");
			return snapshot();
		} catch (error) {
			startupError = serializeError(error);
			await runCleanup(true).catch(() => {});
			throw error;
		}
	}

	async function runDispose() {
		if (startPromise) await startPromise.catch(() => {});
		if (state === "STOPPED") return snapshot();
		if (state === "FAILED" && cleanupPromise) return cleanupPromise;
		return runCleanup(false);
	}

	function start() {
		if (TERMINAL_STATES.has(state)) return Promise.reject(terminalError());
		if (startPromise) return startPromise;
		startPromise = runStart();
		return startPromise;
	}

	function dispose() {
		if (disposePromise) return disposePromise;
		stopRequested = true;
		disposePromise = runDispose();
		return disposePromise;
	}

	return Object.freeze({ start, dispose, snapshot });
}
