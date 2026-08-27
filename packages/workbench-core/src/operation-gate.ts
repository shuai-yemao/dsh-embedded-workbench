export type OperationRunner<Result> = (generation: number) => Promise<Result>;

export class OperationGate<Result> {
    #requestedGeneration = 0;
    #drainPromise: Promise<Result> | undefined;

    get requestedGeneration(): number {
        return this.#requestedGeneration;
    }

    request(run: OperationRunner<Result>): Promise<Result> {
        this.#requestedGeneration += 1;
        if (this.#drainPromise === undefined) {
            this.#drainPromise = this.#drain(run).finally(() => {
                this.#drainPromise = undefined;
            });
        }
        return this.#drainPromise;
    }

    async #drain(run: OperationRunner<Result>): Promise<Result> {
        let completedGeneration = 0;
        let result: Result | undefined;
        while (completedGeneration !== this.#requestedGeneration) {
            completedGeneration = this.#requestedGeneration;
            try {
                result = await run(completedGeneration);
            } catch (error) {
                if (completedGeneration === this.#requestedGeneration) throw error;
            }
        }
        return result as Result;
    }
}
