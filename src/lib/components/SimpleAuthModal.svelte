<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { authStore } from '$lib/stores/authStore';
	import { registerUserInCloud, verifyUserCredentials } from '$lib/cloudStorage';
	import { User, Lock, LogIn, UserPlus, ShieldCheck, KeyRound } from 'lucide-svelte';

	export let show: boolean = false;

	let mode: 'register' | 'login' = 'register';
	let username = '';
	let pin = '';
	let confirmPin = '';
	let errorMessage = '';
	let isLoading = false;

	const dispatch = createEventDispatcher();

	$: user = $authStore;

	async function handleSubmit() {
		const cleanUser = username.trim().toLowerCase();
		const cleanPin = pin.trim();

		if (!cleanUser) {
			errorMessage = 'Por favor ingresa tu nombre de usuario o apodo.';
			return;
		}
		if (!cleanPin || cleanPin.length < 4) {
			errorMessage = 'El PIN debe tener al menos 4 dígitos numéricos o letras.';
			return;
		}

		if (mode === 'register') {
			if (cleanPin !== confirmPin.trim()) {
				errorMessage = 'Los PIN ingresados no coinciden.';
				return;
			}

			isLoading = true;
			errorMessage = '';
			const regResult = await registerUserInCloud(cleanUser, cleanPin);
			isLoading = false;

			if (!regResult.success) {
				errorMessage = regResult.message || 'Error al registrar el usuario.';
				return;
			}

			authStore.login(cleanUser, cleanPin);
			dispatch('login', { username: cleanUser, pin: cleanPin, isNew: true });
			show = false;
		} else {
			isLoading = true;
			errorMessage = '';
			const verifyResult = await verifyUserCredentials(cleanUser, cleanPin);
			isLoading = false;

			if (!verifyResult.success) {
				errorMessage = verifyResult.message || 'PIN o credenciales incorrectas.';
				return;
			}

			authStore.login(cleanUser, cleanPin);
			dispatch('login', { username: cleanUser, pin: cleanPin, isNew: false });
			show = false;
		}
	}

	function handleClose() {
		show = false;
		dispatch('close');
	}
</script>

{#if show}
	<div class="auth-backdrop" on:click|self={handleClose} role="dialog" aria-modal="true">
		<div class="auth-modal">
			<div class="auth-header">
				<div class="badge">
					<ShieldCheck size={16} />
					<span>Perfil de Evidencias Digitales</span>
				</div>
				<h2>{mode === 'register' ? 'Registrar Nuevo Perfil' : 'Iniciar Sesión'}</h2>
				<p>
					{mode === 'register'
						? 'Crea tu perfil con un Usuario y PIN para que todos los chats .ZIP que importes queden guardados permanentemente.'
						: 'Ingresa tu usuario y PIN para recuperar automáticamente todos los casos y chats guardados.'}
				</p>
			</div>

			<!-- Pestañas Registro / Login -->
			{#if !user.isLoggedIn}
				<div class="auth-tabs">
					<button
						class="tab-btn"
						class:active={mode === 'register'}
						on:click={() => { mode = 'register'; errorMessage = ''; }}
					>
						<UserPlus size={16} />
						<span>Registrarse</span>
					</button>
					<button
						class="tab-btn"
						class:active={mode === 'login'}
						on:click={() => { mode = 'login'; errorMessage = ''; }}
					>
						<LogIn size={16} />
						<span>Iniciar Sesión</span>
					</button>
				</div>
			{/if}

			{#if user.isLoggedIn}
				<div class="logged-card">
					<div class="user-avatar">{user.username.slice(0, 2).toUpperCase()}</div>
					<div class="user-info">
						<span class="welcome">Perfil activo:</span>
						<strong class="username">@{user.username}</strong>
						<span class="status-pill">✅ Sincronización en Nube Local Activa</span>
					</div>
					<button class="logout-btn" on:click={() => authStore.logout()}>
						Cerrar Sesión / Cambiar de Perfil
					</button>
				</div>
			{:else}
				<form on:submit|preventDefault={handleSubmit} class="auth-form">
					{#if errorMessage}
						<div class="error-banner">
							{errorMessage}
						</div>
					{/if}

					<div class="input-group">
						<label for="username">
							<User size={16} /> Usuario / Nombre de Perfil
						</label>
						<input
							id="username"
							type="text"
							placeholder="Ej: beatriz_perito"
							bind:value={username}
							autocomplete="username"
							required
						/>
					</div>

					<div class="input-group">
						<label for="pin">
							<Lock size={16} /> PIN o Clave Secreta (Mínimo 4 caracteres)
						</label>
						<input
							id="pin"
							type="password"
							placeholder="Ej: 1234"
							bind:value={pin}
							maxlength="20"
							required
						/>
					</div>

					{#if mode === 'register'}
						<div class="input-group">
							<label for="confirmPin">
								<KeyRound size={16} /> Confirmar PIN Secreto
							</label>
							<input
								id="confirmPin"
								type="password"
								placeholder="Confirma tu PIN"
								bind:value={confirmPin}
								maxlength="20"
								required
							/>
						</div>
					{/if}

					<div class="hint">
						💡 <strong>¿Cómo funciona?</strong> No requiere correo electrónico. Al registrar tu usuario y tu PIN, todos los archivos .ZIP que proceses se guardarán automáticamente en tu base de datos y no se borrarán al recargar.
					</div>

					<button type="submit" class="submit-btn" disabled={isLoading}>
						{#if isLoading}
							<span>Procesando...</span>
						{:else if mode === 'register'}
							<UserPlus size={18} />
							<span>Registrar Perfil y Guardar Chats</span>
						{:else}
							<LogIn size={18} />
							<span>Iniciar Sesión y Cargar Chats</span>
						{/if}
					</button>
				</form>
			{/if}
		</div>
	</div>
{/if}

<style>
	.auth-backdrop {
		position: fixed;
		inset: 0;
		background-color: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		padding: 1rem;
	}

	.auth-modal {
		background-color: var(--color-bg-surface, #1e293b);
		color: var(--color-text, #f8fafc);
		width: 100%;
		max-width: 450px;
		border-radius: 20px;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
		padding: 2rem;
		border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
		animation: modalFade 0.25s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes modalFade {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(10px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.auth-header {
		text-align: center;
		margin-bottom: 1.2rem;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: rgba(37, 211, 102, 0.15);
		color: #25d366;
		font-size: 0.8rem;
		font-weight: 600;
		padding: 4px 12px;
		border-radius: 20px;
		margin-bottom: 10px;
	}

	.auth-header h2 {
		font-size: 1.4rem;
		font-weight: 700;
		margin: 0 0 6px 0;
	}

	.auth-header p {
		font-size: 0.85rem;
		color: var(--color-text-secondary, #94a3b8);
		margin: 0;
		line-height: 1.4;
	}

	.auth-tabs {
		display: flex;
		gap: 6px;
		background-color: rgba(0, 0, 0, 0.25);
		padding: 4px;
		border-radius: 12px;
		margin-bottom: 1.2rem;
	}

	.tab-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 9px;
		border-radius: 8px;
		border: none;
		background: transparent;
		color: #94a3b8;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.tab-btn.active {
		background-color: #25d366;
		color: #0f172a;
		box-shadow: 0 2px 8px rgba(37, 211, 102, 0.3);
	}

	.auth-form {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.input-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.input-group label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--color-text, #cbd5e1);
	}

	.input-group input {
		width: 100%;
		padding: 10px 14px;
		border-radius: 10px;
		border: 1px solid var(--color-border, #334155);
		background-color: var(--color-bg-input, #0f172a);
		color: var(--color-text, #f8fafc);
		font-size: 0.95rem;
		transition: all 0.2s ease;
	}

	.input-group input:focus {
		outline: none;
		border-color: #25d366;
		box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.25);
	}

	.error-banner {
		background-color: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.4);
		color: #fca5a5;
		padding: 10px 14px;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 500;
	}

	.hint {
		background: rgba(255, 255, 255, 0.05);
		padding: 10px 12px;
		border-radius: 10px;
		font-size: 0.8rem;
		color: #94a3b8;
		line-height: 1.4;
	}

	.submit-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		width: 100%;
		padding: 12px;
		border-radius: 12px;
		border: none;
		background: linear-gradient(135deg, #25d366 0%, #128c7e 100%);
		color: white;
		font-weight: 600;
		font-size: 0.95rem;
		cursor: pointer;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.submit-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 8px 20px -4px rgba(37, 211, 102, 0.4);
	}

	.submit-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.logged-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 1rem 0;
	}

	.user-avatar {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: linear-gradient(135deg, #25d366 0%, #128c7e 100%);
		color: white;
		font-size: 1.5rem;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.user-info {
		text-align: center;
	}

	.welcome {
		display: block;
		font-size: 0.85rem;
		color: #94a3b8;
	}

	.username {
		font-size: 1.3rem;
		color: #f8fafc;
	}

	.status-pill {
		display: block;
		margin-top: 6px;
		font-size: 0.8rem;
		color: #25d366;
		font-weight: 500;
	}

	.logout-btn {
		padding: 9px 18px;
		border-radius: 10px;
		border: 1px solid rgba(239, 68, 68, 0.4);
		background: rgba(239, 68, 68, 0.1);
		color: #fca5a5;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.logout-btn:hover {
		background: rgba(239, 68, 68, 0.2);
	}
</style>
