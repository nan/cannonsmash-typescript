import * as THREE from 'three';
import { TABLE_LENGTH, TABLE_WIDTH, TABLE_HEIGHT, TABLE_THICK, NET_HEIGHT, AREAXSIZE, AREAYSIZE, AREAZSIZE } from './constants';

// --- Lighting Constants ---
const DIR_LIGHT_COLOR = 0xFFFFFF;
const DIR_LIGHT_INTENSITY = 3;
const DIR_LIGHT_POSITION = new THREE.Vector3(-1, 2, 4);
const AMB_LIGHT_COLOR = 0x404040;
const AMB_LIGHT_INTENSITY = 2;

// --- Field Element Constants ---
const FLOOR_TEXTURE_REPEAT = 4;

const TARGET_INDICATOR_INNER_RADIUS = 0.1;
const TARGET_INDICATOR_OUTER_RADIUS = 0.12;
const TARGET_INDICATOR_SEGMENTS = 32;
const TARGET_INDICATOR_COLOR = 0xffff00;
const TARGET_INDICATOR_Y_OFFSET = 0.01;

const TABLETOP_COLOR = 0x0000FF;
const TABLETOP_OPACITY = 0.7;

const TABLE_LINE_COLOR = 0xFFFFFF;
const TABLE_SIDE_LINE_WIDTH = 0.02;
const TABLE_END_LINE_DEPTH = 0.02;
const TABLE_CENTER_LINE_WIDTH = 0.01;
const TABLE_LINE_THICKNESS = 0.01;
const TABLE_LINE_Y_OFFSET = 0.005;
const TABLE_LINE_EDGE_OFFSET = 0.01;

const TABLE_LEG_COLOR = 0x006400;
const TABLE_LEG_SIZE = 0.05;
const TABLE_LEG_OFFSET = 0.1;

const NET_COLOR = 0x00FF00;
const NET_OPACITY = 0.4;


export class Field {
    public mesh: THREE.Group;
    public targetIndicator: THREE.Mesh;
    private textureLoader = new THREE.TextureLoader();

    constructor() {
        this.mesh = new THREE.Group();

        this.createLighting();
        this.createFloor();
        this.createWalls();
        this.createTable();
        this.createNet();

        // Create Target Indicator
        const targetGeometry = new THREE.RingGeometry(TARGET_INDICATOR_INNER_RADIUS, TARGET_INDICATOR_OUTER_RADIUS, TARGET_INDICATOR_SEGMENTS);
        const targetMaterial = new THREE.MeshBasicMaterial({ color: TARGET_INDICATOR_COLOR, side: THREE.DoubleSide });
        this.targetIndicator = new THREE.Mesh(targetGeometry, targetMaterial);
        this.targetIndicator.rotation.x = -Math.PI / 2;
        this.targetIndicator.position.y = TABLE_HEIGHT + TARGET_INDICATOR_Y_OFFSET; // Slightly above the table
        this.mesh.add(this.targetIndicator);
    }

    private createFloor() {
        const floorTexture = this.textureLoader.load('images/Floor.jpg');
        floorTexture.wrapS = THREE.RepeatWrapping;
        floorTexture.wrapT = THREE.RepeatWrapping;
        floorTexture.repeat.set(FLOOR_TEXTURE_REPEAT, FLOOR_TEXTURE_REPEAT);

        const floorGeometry = new THREE.PlaneGeometry(AREAXSIZE * 2, AREAYSIZE * 2);
        const floorMaterial = new THREE.MeshStandardMaterial({ map: floorTexture });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        this.mesh.add(floor);
    }

    private createWalls() {
        // Mapping from C++ code (Y is depth, Z is height) to Three.js (Z is depth, Y is height)
        const wallHeight = AREAZSIZE;
        const halfHeight = wallHeight / 2;

        // Wall 0 (Left)
        const leftTexture = this.textureLoader.load('images/Left.jpg');
        const leftMaterial = new THREE.MeshStandardMaterial({ map: leftTexture });
        const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(AREAYSIZE * 2, wallHeight), leftMaterial);
        leftWall.position.set(-AREAXSIZE, halfHeight, 0);
        leftWall.rotation.y = Math.PI / 2;
        this.mesh.add(leftWall);

        // Wall 1 (Front in C++, which is the back wall at -Z)
        const frontTexture = this.textureLoader.load('images/Front.jpg');
        const frontMaterial = new THREE.MeshStandardMaterial({ map: frontTexture });
        const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(AREAXSIZE * 2, wallHeight), frontMaterial);
        frontWall.position.set(0, halfHeight, -AREAYSIZE);
        this.mesh.add(frontWall);

        // Wall 2 (Right)
        const rightTexture = this.textureLoader.load('images/Right.jpg');
        const rightMaterial = new THREE.MeshStandardMaterial({ map: rightTexture });
        const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(AREAYSIZE * 2, wallHeight), rightMaterial);
        rightWall.position.set(AREAXSIZE, halfHeight, 0);
        rightWall.rotation.y = -Math.PI / 2;
        this.mesh.add(rightWall);

        // Wall 3 (Back in C++, which is the front wall at +Z)
        const backTexture = this.textureLoader.load('images/Back.jpg');
        const backMaterial = new THREE.MeshStandardMaterial({ map: backTexture });
        const backWall = new THREE.Mesh(new THREE.PlaneGeometry(AREAXSIZE * 2, wallHeight), backMaterial);
        backWall.position.set(0, halfHeight, AREAYSIZE);
        backWall.rotation.y = Math.PI;
        this.mesh.add(backWall);
    }

    private createTable() {
        const tableGroup = new THREE.Group();

        // Tabletop
        const tabletopMaterial = new THREE.MeshStandardMaterial({
            color: TABLETOP_COLOR,
            transparent: true,
            opacity: TABLETOP_OPACITY
        });
        const tabletopGeometry = new THREE.BoxGeometry(TABLE_WIDTH, TABLE_THICK, TABLE_LENGTH);
        const tabletop = new THREE.Mesh(tabletopGeometry, tabletopMaterial);
        tabletop.position.y = TABLE_HEIGHT - (TABLE_THICK / 2);
        tableGroup.add(tabletop);

        // White lines
        const lineMaterial = new THREE.MeshBasicMaterial({ color: TABLE_LINE_COLOR });
        const sideLineGeometry = new THREE.BoxGeometry(TABLE_SIDE_LINE_WIDTH, TABLE_LINE_THICKNESS, TABLE_LENGTH);
        const endLineGeometry = new THREE.BoxGeometry(TABLE_WIDTH, TABLE_LINE_THICKNESS, TABLE_END_LINE_DEPTH);
        const centerLineGeometry = new THREE.BoxGeometry(TABLE_CENTER_LINE_WIDTH, TABLE_LINE_THICKNESS, TABLE_LENGTH);

        const linePositionY = TABLE_HEIGHT + TABLE_LINE_Y_OFFSET;

        const leftLine = new THREE.Mesh(sideLineGeometry, lineMaterial);
        leftLine.position.set(-TABLE_WIDTH / 2 + TABLE_LINE_EDGE_OFFSET, linePositionY, 0);
        tableGroup.add(leftLine);

        const rightLine = new THREE.Mesh(sideLineGeometry, lineMaterial);
        rightLine.position.set(TABLE_WIDTH / 2 - TABLE_LINE_EDGE_OFFSET, linePositionY, 0);
        tableGroup.add(rightLine);

        const farLine = new THREE.Mesh(endLineGeometry, lineMaterial);
        farLine.position.set(0, linePositionY, -TABLE_LENGTH / 2 + TABLE_LINE_EDGE_OFFSET);
        tableGroup.add(farLine);

        const nearLine = new THREE.Mesh(endLineGeometry, lineMaterial);
        nearLine.position.set(0, linePositionY, TABLE_LENGTH / 2 - TABLE_LINE_EDGE_OFFSET);
        tableGroup.add(nearLine);

        const centerLine = new THREE.Mesh(centerLineGeometry, lineMaterial);
        centerLine.position.set(0, linePositionY, 0);
        tableGroup.add(centerLine);

        // Table legs
        const legMaterial = new THREE.MeshStandardMaterial({ color: TABLE_LEG_COLOR });
        const legGeometry = new THREE.BoxGeometry(TABLE_LEG_SIZE, TABLE_HEIGHT - TABLE_THICK, TABLE_LEG_SIZE);
        const legPositions = [
            new THREE.Vector3(-TABLE_WIDTH / 2 + TABLE_LEG_OFFSET, (TABLE_HEIGHT - TABLE_THICK) / 2, -TABLE_LENGTH / 2 + TABLE_LEG_OFFSET),
            new THREE.Vector3(TABLE_WIDTH / 2 - TABLE_LEG_OFFSET, (TABLE_HEIGHT - TABLE_THICK) / 2, -TABLE_LENGTH / 2 + TABLE_LEG_OFFSET),
            new THREE.Vector3(-TABLE_WIDTH / 2 + TABLE_LEG_OFFSET, (TABLE_HEIGHT - TABLE_THICK) / 2, TABLE_LENGTH / 2 - TABLE_LEG_OFFSET),
            new THREE.Vector3(TABLE_WIDTH / 2 - TABLE_LEG_OFFSET, (TABLE_HEIGHT - TABLE_THICK) / 2, TABLE_LENGTH / 2 - TABLE_LEG_OFFSET),
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
            color: NET_COLOR,
            transparent: true,
            opacity: NET_OPACITY,
            side: THREE.DoubleSide
        });
        const netGeometry = new THREE.PlaneGeometry(TABLE_WIDTH, NET_HEIGHT);
        const net = new THREE.Mesh(netGeometry, netMaterial);
        net.position.set(0, TABLE_HEIGHT + (NET_HEIGHT / 2), 0);
        this.mesh.add(net);
    }

    private createLighting() {
        const directionalLight = new THREE.DirectionalLight(DIR_LIGHT_COLOR, DIR_LIGHT_INTENSITY);
        directionalLight.position.copy(DIR_LIGHT_POSITION);
        this.mesh.add(directionalLight);

        const ambientLight = new THREE.AmbientLight(AMB_LIGHT_COLOR, AMB_LIGHT_INTENSITY);
        this.mesh.add(ambientLight);
    }
}
