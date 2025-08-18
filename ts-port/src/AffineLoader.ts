import * as THREE from 'three';

// Represents the data loaded from an .affine file
export interface AffineData {
    matrices: THREE.Matrix4[];
}

export class AffineLoader extends THREE.Loader {
    load(
        url: string,
        onLoad: (data: AffineData) => void,
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

    parse(text: string): AffineData {
        const matrices: THREE.Matrix4[] = [];
        const lines = text.split('\n');

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine.includes('Affine3')) {
                continue;
            }

            // This regex is designed to be robust and extract the 12 numbers
            const tokens = trimmedLine.split(/[(),\s]+/).filter(Boolean);

            // Expected: ["Affine3", "n1", "n2", "n3", ... "n12"]
            if (tokens[0] !== 'Affine3' || tokens.length < 13) {
                continue;
            }

            const numbers = tokens.slice(1, 13).map(parseFloat);

            if (numbers.some(isNaN)) {
                continue; // Skip if any parsing resulted in NaN
            }

            if (numbers.length === 12) {
                const m = numbers;
                const matrix = new THREE.Matrix4();

                // The C++ code reads the matrix in row-major order.
                // Three.js's .set() method takes elements in column-major order.
                // So we need to transpose the 3x3 part while feeding it to .set().
                // m[0], m[1], m[2] is the first row. It becomes the first column.
                // m[3], m[4], m[5] is the second row. It becomes the second column.
                // etc.
                // The translation part (m[9], m[10], m[11]) becomes the last column's xyz.
                matrix.set(
                    m[0], m[4], m[8], m[9],
                    m[1], m[5], m[9], m[10],
                    m[2], m[6], m[10], m[11],
                    0,    0,    0,    1
                );

                // Let's re-verify the C++ to Three.js mapping.
                // C++ row-major: R11, R12, R13, R21, R22, R23, R31, R32, R33, Tx, Ty, Tz
                // m indices:     0,   1,   2,   3,   4,   5,   6,   7,   8,   9,  10, 11
                // Three.js .set() column-major order:
                // M11, M21, M31, M41,  (col 1)
                // M12, M22, M32, M42,  (col 2)
                // M13, M23, M33, M43,  (col 3)
                // M14, M24, M34, M44   (col 4)
                // Mapping:
                // M11=R11=m[0], M21=R21=m[3], M31=R31=m[6], M41=0
                // M12=R12=m[1], M22=R22=m[4], M32=R32=m[7], M42=0
                // M13=R13=m[2], M23=R23=m[5], M33=R33=m[8], M43=0
                // M14=Tx=m[9],  M24=Ty=m[10], M34=Tz=m[11], M44=1
                matrix.set(
                    m[0], m[3], m[6], 0,
                    m[1], m[4], m[7], 0,
                    m[2], m[5], m[8], 0,
                    m[9], m[10], m[11], 1
                );

                matrices.push(matrix);
            }
        }

        return { matrices };
    }
}
