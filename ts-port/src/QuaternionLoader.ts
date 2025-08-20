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
        onError?: (error: unknown) => void
    ) {
        const loader = new THREE.FileLoader(this.manager);
        loader.setPath(this.path);
        loader.setResponseType('text');
        loader.load(url, (text) => {
            try {
                const data = this.parse(text as string);
                onLoad(data);
            } catch (e) {
                if (onError) {
                    onError(e);
                } else {
                    console.error(e);
                }
            }
        }, onProgress, (err) => onError ? onError(err) : undefined);
    }

    parse(text: string): QuaternionData {
        const origin = new THREE.Vector3();
        const quaternions: THREE.Quaternion[] = [];

        const lines = text.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('Frame')) {
                continue;
            }

            if (trimmedLine.startsWith('Origin')) {
                const match = /Origin\(([^,]+),([^,]+),([^)]+)\)/.exec(trimmedLine);
                if (match) {
                    const x = parseFloat(match[1]);
                    const y = parseFloat(match[2]);
                    const z = parseFloat(match[3]);
                    origin.set(x, y, z);
                }
            } else if (trimmedLine.startsWith('Quaternion')) {
                const match = /Quaternion\(([^,]+),\s*\(([^,]+),([^,]+),([^)]+)\)\)/.exec(trimmedLine);
                if (match) {
                    // C++ code reads w, x, y, z
                    // v[0] is w, and it's negated.
                    const w = -parseFloat(match[1]);
                    const x = parseFloat(match[2]);
                    const y = parseFloat(match[3]);
                    const z = parseFloat(match[4]);
                    // THREE.Quaternion constructor is (x, y, z, w)
                    quaternions.push(new THREE.Quaternion(x, y, z, w));
                }
            }
        }

        return { origin, quaternions };
    }
}
