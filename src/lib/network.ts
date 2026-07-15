/** Checks real server reachability without relying on navigator.onLine. */
export async function isNetworkReachable(): Promise<boolean> {
	try {
		await fetch(`/api/me?__online_check=${Date.now()}`, {
			method: 'HEAD',
			cache: 'no-store'
		})
		return true
	} catch {
		return false
	}
}
