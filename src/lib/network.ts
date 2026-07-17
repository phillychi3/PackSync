/** Checks real server reachability without relying on navigator.onLine. */
export async function isNetworkReachable(): Promise<boolean> {
	try {
		const response = await fetch(`/api/health?__online_check=${Date.now()}`, {
			method: 'HEAD',
			cache: 'no-store'
		})
		return response.ok
	} catch {
		return false
	}
}
