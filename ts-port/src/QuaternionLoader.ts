import * as THREE from 'three';

export interface QuaternionData {
    origin: THREE.Vector3;
    quaternions: THREE.Quaternion[];
}

export class QuaternionLoader extends THREE.Loader {
    load(
        url: string,
        onLoad: (data: QuaternionData) => void,
        onProgress?: (event: ProgressEvent) => void,
        onError?: (event: ErrorEvent) => void
    ) {
        const loader = new THREE.FileLoader(this.manager);
        loader.setPath(this.path);
        loader.setResponseType('text');
        loader.load(url, (text) => {
            try {
                const data = this.parse(text as string);
                onLoad(data);
            } catch (e: any) {
                if (onError) {
                    onError(e);
                } else {
                    console.error(e);
                }
            }
        }, onProgress, onError);
    }

    parse(text: string): QuaternionData {
        const origin = new THREE.Vector3();
        const quaternions: THREE.Quaternion[] = [];

        const lines = text.split('\\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                continue;
            }

            const tokens = trimmedLine.split(/[\\s,();]+/);
            const command = tokens[0];

            if (command === 'Origin') {
                const x = parseFloat(tokens[1]);
                const y = parseFloat(tokens[2]);
                const z = parseFloat(tokens[3]);
                origin.set(x, y, z);
            } else if (command === 'Quaternion') {
                // C++ code reads w, x, y, z
                // v[0] is w, and it's negated.
                const w = -parseFloat(tokens[1]);
                const x = parseFloat(tokens[2]);
                const y = parseFloat(tokens[3]);
                const z = parseFloat(tokens[4]);
                // THREE.Quaternion constructor is (x, y, z, w)
                quaternions.push(new THREE.Quaternion(x, y, z, w));
            }
        }

        return { origin, quaternions };
    }
}
