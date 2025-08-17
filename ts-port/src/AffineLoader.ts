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
        const lines = text.split('\\n');
        const numbers: number[] = [];

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                continue;
            }

            const tokens = trimmedLine.split(/[\\s,();]+/);

            // Collect all numbers from the file
            for (const token of tokens) {
                if (token === 'Affine3') continue;
                const num = parseFloat(token);
                if (!isNaN(num)) {
                    numbers.push(num);
                }
            }
        }

        // Process numbers in chunks of 12
        for (let i = 0; (i + 11) < numbers.length; i += 12) {
            const m = numbers.slice(i, i + 12);
            const matrix = new THREE.Matrix4();

            // The C++ code reads 12 values into a 4x3 matrix, then it's used as a 4x4 matrix.
            // This corresponds to setting the elements of a Matrix4 in column-major order,
            // but the C++ code assigns them as m[row][col], suggesting row-major input.
            // Let's assume row-major and set the elements accordingly.
            matrix.set(
                m[0], m[1], m[2], m[9],  // col 1
                m[3], m[4], m[5], m[10], // col 2
                m[6], m[7], m[8], m[11], // col 3
                0,    0,    0,    1      // col 4
            );
            // The C++ code seems to be reading into m[x][y] where x is row and y is column
            // m[0][0], m[0][1], m[0][2]
            // m[1][0], m[1][1], m[1][2]
            // m[2][0], m[2][1], m[2][2]
            // m[3][0], m[3][1], m[3][2] -> This is the translation part
            // Let's re-check the loop in C++ `m[x/3][y%3] = f` for i=0..11
            // i=0: m[0][0]
            // i=1: m[0][1]
            // i=2: m[0][2]
            // i=3: m[1][0]
            // ...
            // i=9: m[3][0] -> tx
            // i=10: m[3][1] -> ty
            // i=11: m[3][2] -> tz
            // This confirms row-major order for the 3x4 part.
            // Three.js Matrix4.set() takes elements in column-major order.
            matrix.set(
                m[0], m[3], m[6], 0,
                m[1], m[4], m[7], 0,
                m[2], m[5], m[8], 0,
                m[9], m[10], m[11], 1
            );

            matrices.push(matrix);
        }

        return { matrices };
    }
}
