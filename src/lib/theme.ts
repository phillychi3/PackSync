export const THEME_STORAGE_KEY = 'packsync-theme'

export function applyDarkMode(enabled: boolean) {
	document.documentElement.classList.toggle('dark', enabled)
	document.documentElement.style.colorScheme = enabled ? 'dark' : 'light'
	document
		.querySelector('meta[name="theme-color"]')
		?.setAttribute('content', enabled ? '#151817' : '#ff3e00')
}

export function initializeDarkMode() {
	let enabled = false
	try {
		enabled = localStorage.getItem(THEME_STORAGE_KEY) === 'dark'
	} catch {
		void 0
	}
	applyDarkMode(enabled)
	return enabled
}

export function setDarkMode(enabled: boolean) {
	try {
		localStorage.setItem(THEME_STORAGE_KEY, enabled ? 'dark' : 'light')
	} catch {
		void 0
	}
	applyDarkMode(enabled)
}
