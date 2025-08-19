import * as THREE from 'three';
import { TABLE_LENGTH, TABLE_WIDTH, TABLE_HEIGHT, TABLE_THICK, NET_HEIGHT, AREAXSIZE, AREAYSIZE } from './constants';

export class Field {
    public mesh: THREE.Group;
    public targetIndicator: THREE.Mesh;
    private textureLoader = new THREE.TextureLoader();

    constructor() {
        this.mesh = new THREE.Group();

        this.createFloor();
        this.createWalls();
        this.createTable();
        this.createNet();

        // Create Target Indicator
        const targetGeometry = new THREE.RingGeometry(0.1, 0.12, 32);
        const targetMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide });
        this.targetIndicator = new THREE.Mesh(targetGeometry, targetMaterial);
        this.targetIndicator.rotation.x = -Math.PI / 2;
        this.targetIndicator.position.y = TABLE_HEIGHT + 0.01; // Slightly above the table
        this.mesh.add(this.targetIndicator);
    }

    private createFloor() {
        const floorTexture = this.textureLoader.load('images/Floor.jpg');
        floorTexture.wrapS = THREE.RepeatWrapping;
        floorTexture.wrapT = THREE.RepeatWrapping;
        floorTexture.repeat.set(4, 4);

        const floorGeometry = new THREE.PlaneGeometry(AREAXSIZE * 2, AREAYSIZE * 2);
        const floorMaterial = new THREE.MeshStandardMaterial({ map: floorTexture });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        this.mesh.add(floor);
    }

    private createWalls() {
        // NOTE: This is a simplified version of the walls from the C++ code.
        // The original had more complex positioning.
        // For now, placing simple walls around the area.
        const wallHeight = 4;
        const wallGeometry = new THREE.PlaneGeometry(AREAXSIZE * 2, wallHeight);
        const wallMaterial = new THREE.MeshStandardMaterial({color: 0x888888});
        const wall1 = new THREE.Mesh(wallGeometry, wallMaterial);
        wall1.position.set(0, wallHeight/2, -AREAYSIZE);
        this.mesh.add(wall1);

        const wall2 = new THREE.Mesh(new THREE.PlaneGeometry(AREAYSIZE * 2, wallHeight), wallMaterial);
        wall2.position.set(-AREAXSIZE, wallHeight/2, 0);
        wall2.rotation.y = Math.PI / 2;
        this.mesh.add(wall2);

        const wall3 = new THREE.Mesh(new THREE.PlaneGeometry(AREAYSIZE * 2, wallHeight), wallMaterial);
        wall3.position.set(AREAXSIZE, wallHeight/2, 0);
        wall3.rotation.y = -Math.PI / 2;
        this.mesh.add(wall3);
    }

    private createTable() {
        const tableGroup = new THREE.Group();

        // Tabletop
        const tabletopMaterial = new THREE.MeshStandardMaterial({
            color: 0x0000FF,
            transparent: true,
            opacity: 0.7
        });
        const tabletopGeometry = new THREE.BoxGeometry(TABLE_WIDTH, TABLE_THICK, TABLE_LENGTH);
        const tabletop = new THREE.Mesh(tabletopGeometry, tabletopMaterial);
        tabletop.position.y = TABLE_HEIGHT - (TABLE_THICK / 2);
        tableGroup.add(tabletop);

        // White lines
        const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
        const sideLineGeometry = new THREE.BoxGeometry(0.02, 0.01, TABLE_LENGTH);
        const endLineGeometry = new THREE.BoxGeometry(TABLE_WIDTH, 0.01, 0.02);
        const centerLineGeometry = new THREE.BoxGeometry(0.01, 0.01, TABLE_LENGTH);

        const linePositionY = TABLE_HEIGHT + 0.005;

        const leftLine = new THREE.Mesh(sideLineGeometry, lineMaterial);
        leftLine.position.set(-TABLE_WIDTH / 2 + 0.01, linePositionY, 0);
        tableGroup.add(leftLine);

        const rightLine = new THREE.Mesh(sideLineGeometry, lineMaterial);
        rightLine.position.set(TABLE_WIDTH / 2 - 0.01, linePositionY, 0);
        tableGroup.add(rightLine);

        const farLine = new THREE.Mesh(endLineGeometry, lineMaterial);
        farLine.position.set(0, linePositionY, -TABLE_LENGTH / 2 + 0.01);
        tableGroup.add(farLine);

        const nearLine = new THREE.Mesh(endLineGeometry, lineMaterial);
        nearLine.position.set(0, linePositionY, TABLE_LENGTH / 2 - 0.01);
        tableGroup.add(nearLine);

        const centerLine = new THREE.Mesh(centerLineGeometry, lineMaterial);
        centerLine.position.set(0, linePositionY, 0);
        tableGroup.add(centerLine);

        // Table legs
        const legMaterial = new THREE.MeshStandardMaterial({ color: 0x006400 });
        const legGeometry = new THREE.BoxGeometry(0.05, TABLE_HEIGHT - TABLE_THICK, 0.05);
        const legPositions = [
            new THREE.Vector3(-TABLE_WIDTH / 2 + 0.1, (TABLE_HEIGHT - TABLE_THICK) / 2, -TABLE_LENGTH / 2 + 0.1),
            new THREE.Vector3(TABLE_WIDTH / 2 - 0.1, (TABLE_HEIGHT - TABLE_THICK) / 2, -TABLE_LENGTH / 2 + 0.1),
            new THREE.Vector3(-TABLE_WIDTH / 2 + 0.1, (TABLE_HEIGHT - TABLE_THICK) / 2, TABLE_LENGTH / 2 - 0.1),
            new THREE.Vector3(TABLE_WIDTH / 2 - 0.1, (TABLE_HEIGHT - TABLE_THICK) / 2, TABLE_LENGTH / 2 - 0.1),
        ];

        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeometry, legMaterial);
            leg.position.copy(pos);
            tableGroup.add(leg);
        });

        this.mesh.add(tableGroup);
    }

    private createNet() {
        const netMaterial = new THREE.MeshStandardMaterial({
            color: 0x00FF00,
            transparent: true,
            opacity: 0.4,
            side: THREE.DoubleSide
        });
        const netGeometry = new THREE.PlaneGeometry(TABLE_WIDTH, NET_HEIGHT);
        const net = new THREE.Mesh(netGeometry, netMaterial);
        net.position.set(0, TABLE_HEIGHT + (NET_HEIGHT / 2), 0);
        this.mesh.add(net);
    }
}
