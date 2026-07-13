import { writable } from 'svelte/store'

export type TripStoreState = {
	tripId: string | null
	itinerary: unknown[]
	criticalItems: unknown[]
	lastSyncedAt: number | null
}

const initialState: TripStoreState = {
	tripId: null,
	itinerary: [],
	criticalItems: [],
	lastSyncedAt: null
}

export const tripStore = writable<TripStoreState>(initialState)

export function setTripContext(tripId: string) {
	tripStore.update((state) => (state.tripId === tripId ? state : { ...initialState, tripId }))
}

export function setItinerary(items: unknown[]) {
	tripStore.update((state) => ({ ...state, itinerary: items, lastSyncedAt: Date.now() }))
}

export function setCriticalItems(items: unknown[]) {
	tripStore.update((state) => ({ ...state, criticalItems: items, lastSyncedAt: Date.now() }))
}

export function clearTripStore() {
	tripStore.set(initialState)
}
