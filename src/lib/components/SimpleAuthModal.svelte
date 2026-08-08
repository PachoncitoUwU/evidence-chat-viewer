<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { authStore } from '$lib/stores/authStore';
	import { User, Lock, LogIn, ShieldCheck } from 'lucide-svelte';

	export let show: boolean = false;

	let username = '';
	let pin = '';
	let errorMessage = '';

	const dispatch = createEventDispatcher();

	$: user = $authStore;

	function handleLogin() {
		if (!username.trim()) {
			errorMessage = 'Por favor ingresa tu nombre de usuario o apodo.';
			return;
		}
		if (!pin.trim() || pin.trim().length < 4) {
			errorMessage = 'El PIN debe tener al menos 4 dígitos.';
			return;
		}

		errorMessage = '';
		authStore.login(username, pin);
		dispatch('login', { username: username.trim().toLowerCase(), pin: pin.trim() });
		show = false;
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
					<span>Sesión Ultra-Sencilla</span>
				</div>
				<h2>Acceder a mis Chats Guardados</h2>
				<p>Ingresa tu usuario y tu PIN para acceder a tus chats desde cualquier dispositivo.</p>
			</div>

			{#if user.isLoggedIn}
				<div class="logged-card">
					<div class="user-avatar">{user.username.slice(0, 2).toUpperCase()}</div>
					<div class="user-info">
						<span class="welcome">Sesión iniciada como:</span>
						<strong class="username">@{user.username}</strong>
					</div>
					<button class="logout-btn" on:click={() => authStore.logout()}>
						Cerrar Sesión
					</button>
				</div>
			{:else}
				<form on:submit|preventDefault={handleLogin} class="auth-form">
					{#if errorMessage}
						<div class="error-banner">
							{errorMessage}
						</div>
					{/if}

					<div class="input-group">
						<label for="username">
							<User size={16} /> Usuario / Nombre
						</label>
						<input
							id="username"
							type="text"
							placeholder="Ej: beatriz"
							bind:value={username}
							autocomplete="username"
							required
						/>
					</div>

					<div class="input-group">
						<label for="pin">
							<Lock size={16} /> PIN o Clave Corta (Mínimo 4 dígitos)
						</label>
						<input
							id="pin"
							type="password"
							placeholder="Ej: 1234"
							bind:value={pin}
							maxlength="12"
							required
						/>
					</div>

					<div class="hint">
						💡 <strong>¿Cómo funciona?</strong> No necesitas correo. Al escribir tu Usuario y tu PIN en tu celular o en otra PC, volverás a ver automáticamente todos tus chats guardados.
					</div>

					<button type="submit" class="submit-btn">
						<LogIn size={18} />
						<span>Entrar y Sincronizar mis Chats</span>
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
		background-color: rgba(0, 0, 0, 0.65);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		padding: 1rem;
	}

	.auth-modal {
		background-color: var(--color-bg-surface, #ffffff);
		color: var(--color-text, #111827);
		width: 100%;
		max-width: 440px;
		border-radius: 20px;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
		padding: 2rem;
		border: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
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
		margin-bottom: 1.5rem;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: rgba(37, 211, 102, 0.15);
		color: #128c7e;
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
		font-size: 0.9rem;
		color: var(--color-text-secondary, #6b7280);
		margin: 0;
	}

	.auth-form {
		display: flex;
		flex-direction: column;
		gap: 1.2rem;
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
		color: var(--color-text, #374151);
	}

	.input-group input {
		width: 100%;
		padding: 10px 14px;
		border-radius: 10px;
		border: 1px solid var(--color-border, #d1d5db);
		background-color: var(--color-bg-input, #f9fafb);
		color: var(--color-text, #111827);
		font-size: 0.95rem;
		transition: all 0.2s ease;
	}

	.input-group input:focus {
		outline: none;
		border-color: #25d366;
		box-shadow: 0 0 0 3px rgba(37, 211, 102, 0.2);
	}

	.error-banner {
		background-color: #fee2e2;
		color: #991b1b;
		padding: 10px 14px;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 500;
	}

	.hint {
		background: var(--color-bg-hint, #f3f4f6);
		padding: 10px 12px;
		border-radius: 10px;
		font-size: 0.8rem;
		color: var(--color-text-secondary, #4b5563);
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
		font-size: 1rem;
		cursor: pointer;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.submit-btn:hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 20px -4px rgba(37, 211, 102, 0.4);
	}

	.logged-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 1rem 0;
	}

	.user-avatar {
		width: 60px;
		height: 60px;
		border-radius: 50%;
		background: linear-gradient(135deg, #25d366 0%, #128c7e 100%);
		color: white;
		font-size: 1.4rem;
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
		color: var(--color-text-secondary, #6b7280);
	}

	.username {
		font-size: 1.2rem;
		color: var(--color-text, #111827);
	}

	.logout-btn {
		padding: 8px 16px;
		border-radius: 8px;
		border: 1px solid var(--color-border, #d1d5db);
		background: transparent;
		color: #ef4444;
		font-weight: 600;
		cursor: pointer;
	}
</style>
