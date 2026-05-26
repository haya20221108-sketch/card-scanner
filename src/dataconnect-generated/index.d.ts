import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface AddCardToInventoryData {
  userCard_upsert: UserCard_Key;
}

export interface AddCardToInventoryVariables {
  cardId: UUIDString;
  quantity: number;
  condition: string;
}

export interface AddCardToUserCollectionData {
  userCard_insert: UserCard_Key;
}

export interface AddCardToUserCollectionVariables {
  cardId: UUIDString;
  quantity: number;
  condition: string;
  acquiredAt: TimestampString;
  pricePaid?: number | null;
  notes?: string | null;
  isForTrade?: boolean | null;
  isForSale?: boolean | null;
}

export interface BinderCard_Key {
  binderId: UUIDString;
  userCardUserId: UUIDString;
  userCardCardId: UUIDString;
  __typename?: 'BinderCard_Key';
}

export interface Binder_Key {
  id: UUIDString;
  __typename?: 'Binder_Key';
}

export interface Card_Key {
  id: UUIDString;
  __typename?: 'Card_Key';
}

export interface CreateCardData {
  card_insert: Card_Key;
}

export interface CreateCardVariables {
  cardName: string;
  set: string;
  rarity: string;
  imageUrl: string;
}

export interface CreateNewBinderData {
  binder_insert: Binder_Key;
}

export interface CreateNewBinderVariables {
  binderName: string;
  isPublic: boolean;
  description?: string | null;
}

export interface GetCardDetailsData {
  card?: {
    cardName: string;
    set: string;
    rarity: string;
    imageUrl: string;
    cardType?: string | null;
    cardNumber?: string | null;
    artist?: string | null;
    releaseDate?: DateString | null;
  };
}

export interface GetCardDetailsVariables {
  cardId: UUIDString;
}

export interface GetMyBindersData {
  binders: ({
    id: UUIDString;
    binderName: string;
    isPublic: boolean;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Binder_Key)[];
}

export interface RemoveCardFromInventoryData {
  userCard_delete?: UserCard_Key | null;
}

export interface RemoveCardFromInventoryVariables {
  cardId: UUIDString;
}

export interface UpsertUserData {
  user_upsert: User_Key;
}

export interface UpsertUserVariables {
  displayName: string;
}

export interface UserCard_Key {
  userId: UUIDString;
  cardId: UUIDString;
  __typename?: 'UserCard_Key';
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface CreateCardRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateCardVariables): MutationRef<CreateCardData, CreateCardVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateCardVariables): MutationRef<CreateCardData, CreateCardVariables>;
  operationName: string;
}
export const createCardRef: CreateCardRef;

export function createCard(vars: CreateCardVariables): MutationPromise<CreateCardData, CreateCardVariables>;
export function createCard(dc: DataConnect, vars: CreateCardVariables): MutationPromise<CreateCardData, CreateCardVariables>;

interface UpsertUserRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertUserVariables): MutationRef<UpsertUserData, UpsertUserVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: UpsertUserVariables): MutationRef<UpsertUserData, UpsertUserVariables>;
  operationName: string;
}
export const upsertUserRef: UpsertUserRef;

export function upsertUser(vars: UpsertUserVariables): MutationPromise<UpsertUserData, UpsertUserVariables>;
export function upsertUser(dc: DataConnect, vars: UpsertUserVariables): MutationPromise<UpsertUserData, UpsertUserVariables>;

interface AddCardToInventoryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddCardToInventoryVariables): MutationRef<AddCardToInventoryData, AddCardToInventoryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AddCardToInventoryVariables): MutationRef<AddCardToInventoryData, AddCardToInventoryVariables>;
  operationName: string;
}
export const addCardToInventoryRef: AddCardToInventoryRef;

export function addCardToInventory(vars: AddCardToInventoryVariables): MutationPromise<AddCardToInventoryData, AddCardToInventoryVariables>;
export function addCardToInventory(dc: DataConnect, vars: AddCardToInventoryVariables): MutationPromise<AddCardToInventoryData, AddCardToInventoryVariables>;

interface RemoveCardFromInventoryRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: RemoveCardFromInventoryVariables): MutationRef<RemoveCardFromInventoryData, RemoveCardFromInventoryVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: RemoveCardFromInventoryVariables): MutationRef<RemoveCardFromInventoryData, RemoveCardFromInventoryVariables>;
  operationName: string;
}
export const removeCardFromInventoryRef: RemoveCardFromInventoryRef;

export function removeCardFromInventory(vars: RemoveCardFromInventoryVariables): MutationPromise<RemoveCardFromInventoryData, RemoveCardFromInventoryVariables>;
export function removeCardFromInventory(dc: DataConnect, vars: RemoveCardFromInventoryVariables): MutationPromise<RemoveCardFromInventoryData, RemoveCardFromInventoryVariables>;

interface GetMyBindersRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyBindersData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetMyBindersData, undefined>;
  operationName: string;
}
export const getMyBindersRef: GetMyBindersRef;

export function getMyBinders(options?: ExecuteQueryOptions): QueryPromise<GetMyBindersData, undefined>;
export function getMyBinders(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyBindersData, undefined>;

interface CreateNewBinderRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateNewBinderVariables): MutationRef<CreateNewBinderData, CreateNewBinderVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: CreateNewBinderVariables): MutationRef<CreateNewBinderData, CreateNewBinderVariables>;
  operationName: string;
}
export const createNewBinderRef: CreateNewBinderRef;

export function createNewBinder(vars: CreateNewBinderVariables): MutationPromise<CreateNewBinderData, CreateNewBinderVariables>;
export function createNewBinder(dc: DataConnect, vars: CreateNewBinderVariables): MutationPromise<CreateNewBinderData, CreateNewBinderVariables>;

interface GetCardDetailsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetCardDetailsVariables): QueryRef<GetCardDetailsData, GetCardDetailsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: GetCardDetailsVariables): QueryRef<GetCardDetailsData, GetCardDetailsVariables>;
  operationName: string;
}
export const getCardDetailsRef: GetCardDetailsRef;

export function getCardDetails(vars: GetCardDetailsVariables, options?: ExecuteQueryOptions): QueryPromise<GetCardDetailsData, GetCardDetailsVariables>;
export function getCardDetails(dc: DataConnect, vars: GetCardDetailsVariables, options?: ExecuteQueryOptions): QueryPromise<GetCardDetailsData, GetCardDetailsVariables>;

interface AddCardToUserCollectionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddCardToUserCollectionVariables): MutationRef<AddCardToUserCollectionData, AddCardToUserCollectionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AddCardToUserCollectionVariables): MutationRef<AddCardToUserCollectionData, AddCardToUserCollectionVariables>;
  operationName: string;
}
export const addCardToUserCollectionRef: AddCardToUserCollectionRef;

export function addCardToUserCollection(vars: AddCardToUserCollectionVariables): MutationPromise<AddCardToUserCollectionData, AddCardToUserCollectionVariables>;
export function addCardToUserCollection(dc: DataConnect, vars: AddCardToUserCollectionVariables): MutationPromise<AddCardToUserCollectionData, AddCardToUserCollectionVariables>;

