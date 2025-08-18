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

        // Regex to capture point data: point 0,(x,y,z); or point 0,(x,y,z),(u,v);
        const pointRegex = /point\s+\d+,\((.+?),(.+?),(.+?)\)(?:,\((.+?),(.+?)\))?;/;
        // Regex to capture plane data: plane 0,1,2; or plane 0,1,2,3;
        const planeRegex = /plane\s+([\d,]+);/;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                continue;
            }

            const pointMatch = trimmedLine.match(pointRegex);
            if (pointMatch) {
                const x = parseFloat(pointMatch[1]);
                const y = parseFloat(pointMatch[2]);
                const z = parseFloat(pointMatch[3]);
                vertices.push(x, y, z);

                // Check if UVs were captured
                if (pointMatch[4] && pointMatch[5]) {
                    const u = parseFloat(pointMatch[4]);
                    const v = 1.0 - parseFloat(pointMatch[5]); // V is inverted
                    uvs.push(u, v);
                }
                continue;
            }

            const planeMatch = trimmedLine.match(planeRegex);
            if (planeMatch) {
                const faceIndices = planeMatch[1].split(',').map(s => parseInt(s, 10));

                if (faceIndices.some(isNaN)) {
                    continue;
                }

                if (faceIndices.length === 3) {
                    // Triangle
                    faces.push(faceIndices[0], faceIndices[1], faceIndices[2]);
                } else if (faceIndices.length === 4) {
                    // Quad, triangulate as (v0, v1, v2) and (v0, v2, v3)
                    faces.push(faceIndices[0], faceIndices[1], faceIndices[2]);
                    faces.push(faceIndices[0], faceIndices[2], faceIndices[3]);
                }
                continue;
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
