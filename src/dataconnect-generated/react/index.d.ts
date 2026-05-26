import { CreateCardData, CreateCardVariables, UpsertUserData, UpsertUserVariables, AddCardToInventoryData, AddCardToInventoryVariables, RemoveCardFromInventoryData, RemoveCardFromInventoryVariables, GetMyBindersData, CreateNewBinderData, CreateNewBinderVariables, GetCardDetailsData, GetCardDetailsVariables, AddCardToUserCollectionData, AddCardToUserCollectionVariables } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateCard(options?: useDataConnectMutationOptions<CreateCardData, FirebaseError, CreateCardVariables>): UseDataConnectMutationResult<CreateCardData, CreateCardVariables>;
export function useCreateCard(dc: DataConnect, options?: useDataConnectMutationOptions<CreateCardData, FirebaseError, CreateCardVariables>): UseDataConnectMutationResult<CreateCardData, CreateCardVariables>;

export function useUpsertUser(options?: useDataConnectMutationOptions<UpsertUserData, FirebaseError, UpsertUserVariables>): UseDataConnectMutationResult<UpsertUserData, UpsertUserVariables>;
export function useUpsertUser(dc: DataConnect, options?: useDataConnectMutationOptions<UpsertUserData, FirebaseError, UpsertUserVariables>): UseDataConnectMutationResult<UpsertUserData, UpsertUserVariables>;

export function useAddCardToInventory(options?: useDataConnectMutationOptions<AddCardToInventoryData, FirebaseError, AddCardToInventoryVariables>): UseDataConnectMutationResult<AddCardToInventoryData, AddCardToInventoryVariables>;
export function useAddCardToInventory(dc: DataConnect, options?: useDataConnectMutationOptions<AddCardToInventoryData, FirebaseError, AddCardToInventoryVariables>): UseDataConnectMutationResult<AddCardToInventoryData, AddCardToInventoryVariables>;

export function useRemoveCardFromInventory(options?: useDataConnectMutationOptions<RemoveCardFromInventoryData, FirebaseError, RemoveCardFromInventoryVariables>): UseDataConnectMutationResult<RemoveCardFromInventoryData, RemoveCardFromInventoryVariables>;
export function useRemoveCardFromInventory(dc: DataConnect, options?: useDataConnectMutationOptions<RemoveCardFromInventoryData, FirebaseError, RemoveCardFromInventoryVariables>): UseDataConnectMutationResult<RemoveCardFromInventoryData, RemoveCardFromInventoryVariables>;

export function useGetMyBinders(options?: useDataConnectQueryOptions<GetMyBindersData>): UseDataConnectQueryResult<GetMyBindersData, undefined>;
export function useGetMyBinders(dc: DataConnect, options?: useDataConnectQueryOptions<GetMyBindersData>): UseDataConnectQueryResult<GetMyBindersData, undefined>;

export function useCreateNewBinder(options?: useDataConnectMutationOptions<CreateNewBinderData, FirebaseError, CreateNewBinderVariables>): UseDataConnectMutationResult<CreateNewBinderData, CreateNewBinderVariables>;
export function useCreateNewBinder(dc: DataConnect, options?: useDataConnectMutationOptions<CreateNewBinderData, FirebaseError, CreateNewBinderVariables>): UseDataConnectMutationResult<CreateNewBinderData, CreateNewBinderVariables>;

export function useGetCardDetails(vars: GetCardDetailsVariables, options?: useDataConnectQueryOptions<GetCardDetailsData>): UseDataConnectQueryResult<GetCardDetailsData, GetCardDetailsVariables>;
export function useGetCardDetails(dc: DataConnect, vars: GetCardDetailsVariables, options?: useDataConnectQueryOptions<GetCardDetailsData>): UseDataConnectQueryResult<GetCardDetailsData, GetCardDetailsVariables>;

export function useAddCardToUserCollection(options?: useDataConnectMutationOptions<AddCardToUserCollectionData, FirebaseError, AddCardToUserCollectionVariables>): UseDataConnectMutationResult<AddCardToUserCollectionData, AddCardToUserCollectionVariables>;
export function useAddCardToUserCollection(dc: DataConnect, options?: useDataConnectMutationOptions<AddCardToUserCollectionData, FirebaseError, AddCardToUserCollectionVariables>): UseDataConnectMutationResult<AddCardToUserCollectionData, AddCardToUserCollectionVariables>;
