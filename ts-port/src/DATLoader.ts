import * as THREE from 'three';

export class DATLoader extends THREE.Loader {
    load(
        url: string,
        onLoad: (geometry: THREE.BufferGeometry) => void,
        onProgress?: (event: ProgressEvent) => void,
        onError?: (event: ErrorEvent) => void
    ) {
        const loader = new THREE.FileLoader(this.manager);
        loader.setPath(this.path);
        loader.setResponseType('text');
        loader.load(
            url,
            (text) => {
                try {
                    const geometry = this.parse(text as string);
                    onLoad(geometry);
                } catch (e: any) {
                    if (onError) {
                        onError(e);
                    } else {
                        console.error(e);
                    }
                }
            },
            onProgress,
            onError
        );
    }

    parse(text: string): THREE.BufferGeometry {
        const geometry = new THREE.BufferGeometry();

        const vertices: number[] = [];
        const uvs: number[] = [];
        const faces: number[] = [];

        const lines = text.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                continue;
            }

            const tokens = trimmedLine.split(/[\\s,();]+/).filter(Boolean);
            const command = tokens[0];

            if (command === 'point') {
                // Example: point 0,(-0.05,0.1,0.2),(0.5,0.5);
                // tokens: ["point", "0", "-0.05", "0.1", "0.2", "0.5", "0.5"]
                const x = parseFloat(tokens[2]);
                const y = parseFloat(tokens[3]);
                const z = parseFloat(tokens[4]);
                vertices.push(x, y, z);

                if (tokens.length > 5) {
                    const u = parseFloat(tokens[5]);
                    const v = 1.0 - parseFloat(tokens[6]); // V is inverted
                    uvs.push(u, v);
                }

            } else if (command === 'plane') {
                // Example: plane 0,1,2,3,C4;
                // tokens: ["plane", "0", "1", "2", "3", "C4"]
                const faceIndices: number[] = [];
                for (let i = 1; i < tokens.length; i++) {
                    if (tokens[i].startsWith('C')) {
                        // Color index - ignore for now
                        continue;
                    }
                    const index = parseInt(tokens[i], 10);
                    if (!isNaN(index)) {
                        faceIndices.push(index);
                    }
                }

                if (faceIndices.length === 3) {
                    // Triangle
                    faces.push(faceIndices[0], faceIndices[1], faceIndices[2]);
                } else if (faceIndices.length === 4) {
                    // Quad, triangulate as (v0, v1, v2) and (v0, v2, v3)
                    faces.push(faceIndices[0], faceIndices[1], faceIndices[2]);
                    faces.push(faceIndices[0], faceIndices[2], faceIndices[3]);
                }
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        if (uvs.length > 0) {
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        }
        geometry.setIndex(faces);
        geometry.computeVertexNormals();

        return geometry;
    }
}
