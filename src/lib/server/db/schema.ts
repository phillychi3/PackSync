import { relations, sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { user } from './auth.schema'

// ─── Trip ─────────────────────────────────────────────────────────────────────

export const trip = sqliteTable('trip', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text('name').notNull(),
	description: text('description'),
	destination: text('destination'),
	startDate: text('start_date'),
	endDate: text('end_date'),
	status: text('status', { enum: ['planning', 'ongoing', 'completed'] })
		.notNull()
		.default('planning'),
	currency: text('currency').notNull().default('TWD'),
	coverImage: text('cover_image'),
	createdBy: text('created_by')
		.notNull()
		.references(() => user.id),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => new Date())
		.notNull()
})

// ─── Trip Member ──────────────────────────────────────────────────────────────

export const tripMember = sqliteTable(
	'trip_member',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		tripId: text('trip_id')
			.notNull()
			.references(() => trip.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		role: text('role', { enum: ['owner', 'admin', 'member'] })
			.notNull()
			.default('member'),
		joinedAt: integer('joined_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(t) => [uniqueIndex('trip_member_unique').on(t.tripId, t.userId)]
)

// ─── Invitation ───────────────────────────────────────────────────────────────

export const invitation = sqliteTable(
	'invitation',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		tripId: text('trip_id')
			.notNull()
			.references(() => trip.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique(),
		createdBy: text('created_by')
			.notNull()
			.references(() => user.id),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
		usedAt: integer('used_at', { mode: 'timestamp_ms' }),
		usedBy: text('used_by').references(() => user.id)
	},
	(t) => [index('invitation_token_idx').on(t.token), index('invitation_trip_idx').on(t.tripId)]
)

// ─── Place ────────────────────────────────────────────────────────────────────

export const place = sqliteTable(
	'place',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		tripId: text('trip_id')
			.notNull()
			.references(() => trip.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		address: text('address'),
		lat: real('lat'),
		lng: real('lng'),
		googlePlaceId: text('google_place_id'),
		category: text('category', { enum: ['餐廳', '景點', '住宿', '交通', '其他'] }),
		openingHours: text('opening_hours'),
		rating: real('rating'),
		ratingCount: integer('rating_count'),
		notes: text('notes'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(t) => [index('place_trip_idx').on(t.tripId)]
)

// ─── Schedule Item ────────────────────────────────────────────────────────────

export const scheduleItem = sqliteTable(
	'schedule_item',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		tripId: text('trip_id')
			.notNull()
			.references(() => trip.id, { onDelete: 'cascade' }),
		placeId: text('place_id').references(() => place.id, { onDelete: 'set null' }),
		date: text('date').notNull(),
		startTime: text('start_time'),
		endTime: text('end_time'),
		title: text('title').notNull(),
		notes: text('notes'),
		transportMode: text('transport_mode', { enum: ['walk', 'transit', 'drive', 'flight', 'boat'] }),
		order: integer('order').notNull().default(0),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(t) => [index('schedule_item_trip_date_idx').on(t.tripId, t.date)]
)

// ─── Bill ─────────────────────────────────────────────────────────────────────

export const bill = sqliteTable(
	'bill',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		tripId: text('trip_id')
			.notNull()
			.references(() => trip.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		amount: real('amount').notNull(),
		currency: text('currency').notNull().default('TWD'),
		category: text('category', { enum: ['餐飲', '交通', '住宿', '娛樂', '購物', '其他'] }),
		date: text('date').notNull(),
		splitMethod: text('split_method', { enum: ['equal', 'percentage', 'fixed'] })
			.notNull()
			.default('equal'),
		notes: text('notes'),
		createdBy: text('created_by')
			.notNull()
			.references(() => user.id),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull()
	},
	(t) => [index('bill_trip_idx').on(t.tripId)]
)

// ─── Bill Payer ───────────────────────────────────────────────────────────────

export const billPayer = sqliteTable('bill_payer', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	billId: text('bill_id')
		.notNull()
		.references(() => bill.id, { onDelete: 'cascade' }),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	amount: real('amount').notNull()
})

// ─── Bill Participant ─────────────────────────────────────────────────────────

export const billParticipant = sqliteTable('bill_participant', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	billId: text('bill_id')
		.notNull()
		.references(() => bill.id, { onDelete: 'cascade' }),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	// shares數/百分比/固定金額; equal 時為 null
	value: real('value')
})

// ─── Bill Item ────────────────────────────────────────────────────────────────

export const billItem = sqliteTable(
	'bill_item',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		billId: text('bill_id')
			.notNull()
			.references(() => bill.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		amount: real('amount').notNull(),
		notes: text('notes'),
		participants: text('participants') // JSON array of userIds; null means all bill participants
	},
	(t) => [index('bill_item_bill_idx').on(t.billId)]
)

// ─── Settlement ───────────────────────────────────────────────────────────────

export const settlement = sqliteTable(
	'settlement',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		tripId: text('trip_id')
			.notNull()
			.references(() => trip.id, { onDelete: 'cascade' }),
		billId: text('bill_id').references(() => bill.id, { onDelete: 'cascade' }),
		fromUserId: text('from_user_id')
			.notNull()
			.references(() => user.id),
		toUserId: text('to_user_id')
			.notNull()
			.references(() => user.id),
		amount: real('amount').notNull(),
		isSettled: integer('is_settled', { mode: 'boolean' }).notNull().default(false),
		settledAt: integer('settled_at', { mode: 'timestamp_ms' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(t) => [index('settlement_trip_idx').on(t.tripId)]
)

// ─── Packing List ─────────────────────────────────────────────────────────────

export const packingList = sqliteTable('packing_list', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	tripId: text('trip_id')
		.notNull()
		.references(() => trip.id, { onDelete: 'cascade' }),
	name: text('name').notNull().default('主要清單'),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()
})

// ─── Packing Item ─────────────────────────────────────────────────────────────

export const packingItem = sqliteTable('packing_item', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	listId: text('list_id')
		.notNull()
		.references(() => packingList.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	category: text('category'),
	quantity: integer('quantity').notNull().default(1),
	assignedTo: text('assigned_to').references(() => user.id, { onDelete: 'set null' }),
	isChecked: integer('is_checked', { mode: 'boolean' }).notNull().default(false),
	notes: text('notes')
})

// ─── Todo ─────────────────────────────────────────────────────────────────────

export const todo = sqliteTable('todo', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	tripId: text('trip_id')
		.notNull()
		.references(() => trip.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	assignedTo: text('assigned_to').references(() => user.id, { onDelete: 'set null' }),
	dueDate: text('due_date'),
	isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull()
})

// ─── Critical Item ────────────────────────────────────────────────────────────

export const criticalItem = sqliteTable('critical_item', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	tripId: text('trip_id')
		.notNull()
		.references(() => trip.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	description: text('description'),
	icon: text('icon'),
	scheduleItemId: text('schedule_item_id').references(() => scheduleItem.id, {
		onDelete: 'set null'
	})
})

// ─── Critical Item Confirmation ───────────────────────────────────────────────

export const criticalItemConfirmation = sqliteTable(
	'critical_item_confirmation',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		criticalItemId: text('critical_item_id')
			.notNull()
			.references(() => criticalItem.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		scheduleItemId: text('schedule_item_id').references(() => scheduleItem.id, {
			onDelete: 'set null'
		}),
		confirmedAt: integer('confirmed_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(t) => [index('critical_confirmation_item_idx').on(t.criticalItemId)]
)

// ─── Conversation ─────────────────────────────────────────────────────────────

export const conversation = sqliteTable(
	'conversation',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		tripId: text('trip_id')
			.notNull()
			.references(() => trip.id, { onDelete: 'cascade' }),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		title: text('title').notNull().default('新對話'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => new Date())
			.notNull()
	},
	(t) => [index('conversation_trip_user_idx').on(t.tripId, t.userId)]
)

// ─── Message ──────────────────────────────────────────────────────────────────

export const message = sqliteTable(
	'message',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		conversationId: text('conversation_id')
			.notNull()
			.references(() => conversation.id, { onDelete: 'cascade' }),
		role: text('role', { enum: ['user', 'assistant'] }).notNull(),
		content: text('content').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(t) => [index('message_conversation_idx').on(t.conversationId)]
)

// ─── Web Push Subscription ──────────────────────────────────────────────────

export const pushSubscription = sqliteTable(
	'push_subscription',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		endpoint: text('endpoint').notNull().unique(),
		p256dh: text('p256dh').notNull(),
		auth: text('auth').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull()
	},
	(t) => [index('push_subscription_user_idx').on(t.userId)]
)

// ─── Relations ────────────────────────────────────────────────────────────────

export const tripRelations = relations(trip, ({ many }) => ({
	members: many(tripMember),
	invitations: many(invitation),
	places: many(place),
	scheduleItems: many(scheduleItem),
	bills: many(bill),
	settlements: many(settlement),
	packingLists: many(packingList),
	todos: many(todo),
	criticalItems: many(criticalItem),
	conversations: many(conversation)
}))

export const tripMemberRelations = relations(tripMember, ({ one }) => ({
	trip: one(trip, { fields: [tripMember.tripId], references: [trip.id] })
}))

export const invitationRelations = relations(invitation, ({ one }) => ({
	trip: one(trip, { fields: [invitation.tripId], references: [trip.id] })
}))

export const placeRelations = relations(place, ({ one, many }) => ({
	trip: one(trip, { fields: [place.tripId], references: [trip.id] }),
	scheduleItems: many(scheduleItem)
}))

export const scheduleItemRelations = relations(scheduleItem, ({ one, many }) => ({
	trip: one(trip, { fields: [scheduleItem.tripId], references: [trip.id] }),
	place: one(place, { fields: [scheduleItem.placeId], references: [place.id] }),
	confirmations: many(criticalItemConfirmation)
}))

export const billRelations = relations(bill, ({ one, many }) => ({
	trip: one(trip, { fields: [bill.tripId], references: [trip.id] }),
	payers: many(billPayer),
	participants: many(billParticipant),
	items: many(billItem)
}))

export const billPayerRelations = relations(billPayer, ({ one }) => ({
	bill: one(bill, { fields: [billPayer.billId], references: [bill.id] }),
	user: one(user, { fields: [billPayer.userId], references: [user.id] })
}))

export const billParticipantRelations = relations(billParticipant, ({ one }) => ({
	bill: one(bill, { fields: [billParticipant.billId], references: [bill.id] }),
	user: one(user, { fields: [billParticipant.userId], references: [user.id] })
}))

export const billItemRelations = relations(billItem, ({ one }) => ({
	bill: one(bill, { fields: [billItem.billId], references: [bill.id] })
}))

export const settlementRelations = relations(settlement, ({ one }) => ({
	trip: one(trip, { fields: [settlement.tripId], references: [trip.id] }),
	bill: one(bill, { fields: [settlement.billId], references: [bill.id] }),
	fromUser: one(user, { fields: [settlement.fromUserId], references: [user.id] }),
	toUser: one(user, { fields: [settlement.toUserId], references: [user.id] })
}))

export const packingListRelations = relations(packingList, ({ one, many }) => ({
	trip: one(trip, { fields: [packingList.tripId], references: [trip.id] }),
	items: many(packingItem)
}))

export const packingItemRelations = relations(packingItem, ({ one }) => ({
	list: one(packingList, { fields: [packingItem.listId], references: [packingList.id] })
}))

export const todoRelations = relations(todo, ({ one }) => ({
	trip: one(trip, { fields: [todo.tripId], references: [trip.id] })
}))

export const criticalItemRelations = relations(criticalItem, ({ one, many }) => ({
	trip: one(trip, { fields: [criticalItem.tripId], references: [trip.id] }),
	scheduleItem: one(scheduleItem, {
		fields: [criticalItem.scheduleItemId],
		references: [scheduleItem.id]
	}),
	confirmations: many(criticalItemConfirmation)
}))

export const criticalItemConfirmationRelations = relations(criticalItemConfirmation, ({ one }) => ({
	criticalItem: one(criticalItem, {
		fields: [criticalItemConfirmation.criticalItemId],
		references: [criticalItem.id]
	}),
	scheduleItem: one(scheduleItem, {
		fields: [criticalItemConfirmation.scheduleItemId],
		references: [scheduleItem.id]
	})
}))

export const conversationRelations = relations(conversation, ({ one, many }) => ({
	trip: one(trip, { fields: [conversation.tripId], references: [trip.id] }),
	messages: many(message)
}))

export const messageRelations = relations(message, ({ one }) => ({
	conversation: one(conversation, {
		fields: [message.conversationId],
		references: [conversation.id]
	})
}))

export * from './auth.schema'
