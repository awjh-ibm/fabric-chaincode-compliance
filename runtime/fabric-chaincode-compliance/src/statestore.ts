/**
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

export class StateStore {

    public static getInstance() {
        // Do you need arguments? Make it a regular static method instead.
        return this.instance || (this.instance = new this());
    }

    private static instance: StateStore;
    protected data: Map<string, any>;

    private constructor() {
        // Prevent external instantiation
        this.data = new Map();
        let cfg = JSON.parse(process.env.FCC_CONFIG);
        this.set('CFG',cfg);
    }

    /**
     * Set a state store value
     * @param name the name to use as a key
     * @param data the object data to store
     */
    public set(name: string, data: any) {
        this.data.set(name, data);
    }

    /**
     * Get the data associated with the passed key
     * @param name the key to use
     */
    public get(name: string) {
        return this.data.get(name);
    }

}