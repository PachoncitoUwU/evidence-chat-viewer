import * as THREE from 'three';

/**
 * ParticleField
 * ------------------------------------------------------------------
 * Campo de puntos ambiental muy sutil: representa "motas de polvo de
 * archivo" flotando en la oscuridad, no un showcase de partículas.
 * Reacciona levemente al cursor (parallax de cámara), sin brillo
 * neón — usa el acento acero (--steel) a baja opacidad.
 * ------------------------------------------------------------------
 */
export class ParticleField {
	private renderer: THREE.WebGLRenderer;
	private scene = new THREE.Scene();
	private camera: THREE.PerspectiveCamera;
	private points: THREE.Points;
	private targetRotation = { x: 0, y: 0 };
	private currentRotation = { x: 0, y: 0 };
	private frameId = 0;
	private disposed = false;

	constructor(private canvas: HTMLCanvasElement, private particleCount = 420) {
		this.renderer = new THREE.WebGLRenderer({
			canvas,
			alpha: true,
			antialias: true,
			powerPreference: 'low-power'
		});
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 100);
		this.camera.position.z = 8;

		this.points = this.buildPoints();
		this.scene.add(this.points);

		this.resize();
		window.addEventListener('resize', this.resize);
		window.addEventListener('pointermove', this.onPointerMove);

		this.animate();
	}

	private buildPoints(): THREE.Points {
		const geometry = new THREE.BufferGeometry();
		const positions = new Float32Array(this.particleCount * 3);

		for (let i = 0; i < this.particleCount; i++) {
			positions[i * 3] = (Math.random() - 0.5) * 16;
			positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
			positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
		}

		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

		// Color acero (#6e9aab) a muy baja opacidad — ambiente, no protagonismo.
		const material = new THREE.PointsMaterial({
			color: new THREE.Color('#6e9aab'),
			size: 0.028,
			sizeAttenuation: true,
			transparent: true,
			opacity: 0.35,
			depthWrite: false
		});

		return new THREE.Points(geometry, material);
	}

	private onPointerMove = (event: PointerEvent) => {
		const nx = (event.clientX / window.innerWidth) * 2 - 1;
		const ny = (event.clientY / window.innerHeight) * 2 - 1;
		// Rotación objetivo muy leve: parallax ambiental, no interacción llamativa.
		this.targetRotation.y = nx * 0.12;
		this.targetRotation.x = ny * 0.08;
	};

	private resize = () => {
		const { clientWidth, clientHeight } = this.canvas;
		this.renderer.setSize(clientWidth, clientHeight, false);
		this.camera.aspect = clientWidth / Math.max(clientHeight, 1);
		this.camera.updateProjectionMatrix();
	};

	private animate = () => {
		if (this.disposed) return;

		// Interpolación suave (lerp) hacia la rotación objetivo + deriva constante lenta.
		this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.04;
		this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.04;

		this.points.rotation.x = this.currentRotation.x;
		this.points.rotation.y += 0.00035; // deriva ambiental constante
		this.points.rotation.y += (this.currentRotation.y - this.points.rotation.y) * 0;

		this.renderer.render(this.scene, this.camera);
		this.frameId = requestAnimationFrame(this.animate);
	};

	destroy() {
		this.disposed = true;
		cancelAnimationFrame(this.frameId);
		window.removeEventListener('resize', this.resize);
		window.removeEventListener('pointermove', this.onPointerMove);
		this.points.geometry.dispose();
		(this.points.material as THREE.Material).dispose();
		this.renderer.dispose();
	}
}
