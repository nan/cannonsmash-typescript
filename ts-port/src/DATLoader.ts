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
        const faces: number[] = [];

        const lines = text.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                continue;
            }

            if (trimmedLine.startsWith('point')) {
                const match = trimmedLine.match(/\((.*),(.*),(.*)\)/);
                if (match) {
                    const x = parseFloat(match[1]);
                    const y = parseFloat(match[2]);
                    const z = parseFloat(match[3]);
                    vertices.push(x, y, z);
                }
            } else if (trimmedLine.startsWith('plane')) {
                const indicesStr = trimmedLine.substring(
                    trimmedLine.indexOf(' ') + 1,
                    trimmedLine.lastIndexOf(';')
                );
                const tokens = indicesStr.split(',');
                const faceIndices: number[] = [];
                for (const token of tokens) {
                    if (!token.startsWith('C')) {
                        const index = parseInt(token, 10);
                        if (!isNaN(index)) {
                            faceIndices.push(index);
                        }
                    }
                }

                if (faceIndices.length === 3) {
                    faces.push(faceIndices[0], faceIndices[1], faceIndices[2]);
                } else if (faceIndices.length === 4) {
                    faces.push(faceIndices[0], faceIndices[1], faceIndices[2]);
                    faces.push(faceIndices[0], faceIndices[2], faceIndices[3]);
                }
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(faces);
        geometry.computeVertexNormals();

        return geometry;
    }
}
