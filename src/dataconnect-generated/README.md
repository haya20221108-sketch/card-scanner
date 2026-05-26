# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `example`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

**If you're looking for the `React README`, you can find it at [`dataconnect-generated/react/README.md`](./react/README.md)**

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*GetMyBinders*](#getmybinders)
  - [*GetCardDetails*](#getcarddetails)
- [**Mutations**](#mutations)
  - [*CreateCard*](#createcard)
  - [*UpsertUser*](#upsertuser)
  - [*AddCardToInventory*](#addcardtoinventory)
  - [*RemoveCardFromInventory*](#removecardfrominventory)
  - [*CreateNewBinder*](#createnewbinder)
  - [*AddCardToUserCollection*](#addcardtousercollection)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `example`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@dataconnect/generated` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@dataconnect/generated';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## GetMyBinders
You can execute the `GetMyBinders` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getMyBinders(options?: ExecuteQueryOptions): QueryPromise<GetMyBindersData, undefined>;

interface GetMyBindersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyBindersData, undefined>;
}
export const getMyBindersRef: GetMyBindersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getMyBinders(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyBindersData, undefined>;

interface GetMyBindersRef {
  ...
  (dc: DataConnect): QueryRef<GetMyBindersData, undefined>;
}
export const getMyBindersRef: GetMyBindersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getMyBindersRef:
```typescript
const name = getMyBindersRef.operationName;
console.log(name);
```

### Variables
The `GetMyBinders` query has no variables.
### Return Type
Recall that executing the `GetMyBinders` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetMyBindersData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface GetMyBindersData {
  binders: ({
    id: UUIDString;
    binderName: string;
    isPublic: boolean;
    createdAt: TimestampString;
    updatedAt: TimestampString;
  } & Binder_Key)[];
}
```
### Using `GetMyBinders`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getMyBinders } from '@dataconnect/generated';


// Call the `getMyBinders()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getMyBinders();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getMyBinders(dataConnect);

console.log(data.binders);

// Or, you can use the `Promise` API.
getMyBinders().then((response) => {
  const data = response.data;
  console.log(data.binders);
});
```

### Using `GetMyBinders`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getMyBindersRef } from '@dataconnect/generated';


// Call the `getMyBindersRef()` function to get a reference to the query.
const ref = getMyBindersRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getMyBindersRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.binders);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.binders);
});
```

## GetCardDetails
You can execute the `GetCardDetails` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
getCardDetails(vars: GetCardDetailsVariables, options?: ExecuteQueryOptions): QueryPromise<GetCardDetailsData, GetCardDetailsVariables>;

interface GetCardDetailsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: GetCardDetailsVariables): QueryRef<GetCardDetailsData, GetCardDetailsVariables>;
}
export const getCardDetailsRef: GetCardDetailsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
getCardDetails(dc: DataConnect, vars: GetCardDetailsVariables, options?: ExecuteQueryOptions): QueryPromise<GetCardDetailsData, GetCardDetailsVariables>;

interface GetCardDetailsRef {
  ...
  (dc: DataConnect, vars: GetCardDetailsVariables): QueryRef<GetCardDetailsData, GetCardDetailsVariables>;
}
export const getCardDetailsRef: GetCardDetailsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the getCardDetailsRef:
```typescript
const name = getCardDetailsRef.operationName;
console.log(name);
```

### Variables
The `GetCardDetails` query requires an argument of type `GetCardDetailsVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface GetCardDetailsVariables {
  cardId: UUIDString;
}
```
### Return Type
Recall that executing the `GetCardDetails` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `GetCardDetailsData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `GetCardDetails`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, getCardDetails, GetCardDetailsVariables } from '@dataconnect/generated';

// The `GetCardDetails` query requires an argument of type `GetCardDetailsVariables`:
const getCardDetailsVars: GetCardDetailsVariables = {
  cardId: ..., 
};

// Call the `getCardDetails()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await getCardDetails(getCardDetailsVars);
// Variables can be defined inline as well.
const { data } = await getCardDetails({ cardId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await getCardDetails(dataConnect, getCardDetailsVars);

console.log(data.card);

// Or, you can use the `Promise` API.
getCardDetails(getCardDetailsVars).then((response) => {
  const data = response.data;
  console.log(data.card);
});
```

### Using `GetCardDetails`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, getCardDetailsRef, GetCardDetailsVariables } from '@dataconnect/generated';

// The `GetCardDetails` query requires an argument of type `GetCardDetailsVariables`:
const getCardDetailsVars: GetCardDetailsVariables = {
  cardId: ..., 
};

// Call the `getCardDetailsRef()` function to get a reference to the query.
const ref = getCardDetailsRef(getCardDetailsVars);
// Variables can be defined inline as well.
const ref = getCardDetailsRef({ cardId: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = getCardDetailsRef(dataConnect, getCardDetailsVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.card);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.card);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `example` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## CreateCard
You can execute the `CreateCard` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createCard(vars: CreateCardVariables): MutationPromise<CreateCardData, CreateCardVariables>;

interface CreateCardRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateCardVariables): MutationRef<CreateCardData, CreateCardVariables>;
}
export const createCardRef: CreateCardRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createCard(dc: DataConnect, vars: CreateCardVariables): MutationPromise<CreateCardData, CreateCardVariables>;

interface CreateCardRef {
  ...
  (dc: DataConnect, vars: CreateCardVariables): MutationRef<CreateCardData, CreateCardVariables>;
}
export const createCardRef: CreateCardRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createCardRef:
```typescript
const name = createCardRef.operationName;
console.log(name);
```

### Variables
The `CreateCard` mutation requires an argument of type `CreateCardVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateCardVariables {
  cardName: string;
  set: string;
  rarity: string;
  imageUrl: string;
}
```
### Return Type
Recall that executing the `CreateCard` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateCardData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateCardData {
  card_insert: Card_Key;
}
```
### Using `CreateCard`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createCard, CreateCardVariables } from '@dataconnect/generated';

// The `CreateCard` mutation requires an argument of type `CreateCardVariables`:
const createCardVars: CreateCardVariables = {
  cardName: ..., 
  set: ..., 
  rarity: ..., 
  imageUrl: ..., 
};

// Call the `createCard()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createCard(createCardVars);
// Variables can be defined inline as well.
const { data } = await createCard({ cardName: ..., set: ..., rarity: ..., imageUrl: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createCard(dataConnect, createCardVars);

console.log(data.card_insert);

// Or, you can use the `Promise` API.
createCard(createCardVars).then((response) => {
  const data = response.data;
  console.log(data.card_insert);
});
```

### Using `CreateCard`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createCardRef, CreateCardVariables } from '@dataconnect/generated';

// The `CreateCard` mutation requires an argument of type `CreateCardVariables`:
const createCardVars: CreateCardVariables = {
  cardName: ..., 
  set: ..., 
  rarity: ..., 
  imageUrl: ..., 
};

// Call the `createCardRef()` function to get a reference to the mutation.
const ref = createCardRef(createCardVars);
// Variables can be defined inline as well.
const ref = createCardRef({ cardName: ..., set: ..., rarity: ..., imageUrl: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createCardRef(dataConnect, createCardVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.card_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.card_insert);
});
```

## UpsertUser
You can execute the `UpsertUser` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
upsertUser(vars: UpsertUserVariables): MutationPromise<UpsertUserData, UpsertUserVariables>;

interface UpsertUserRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: UpsertUserVariables): MutationRef<UpsertUserData, UpsertUserVariables>;
}
export const upsertUserRef: UpsertUserRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
upsertUser(dc: DataConnect, vars: UpsertUserVariables): MutationPromise<UpsertUserData, UpsertUserVariables>;

interface UpsertUserRef {
  ...
  (dc: DataConnect, vars: UpsertUserVariables): MutationRef<UpsertUserData, UpsertUserVariables>;
}
export const upsertUserRef: UpsertUserRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the upsertUserRef:
```typescript
const name = upsertUserRef.operationName;
console.log(name);
```

### Variables
The `UpsertUser` mutation requires an argument of type `UpsertUserVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface UpsertUserVariables {
  displayName: string;
}
```
### Return Type
Recall that executing the `UpsertUser` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `UpsertUserData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface UpsertUserData {
  user_upsert: User_Key;
}
```
### Using `UpsertUser`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, upsertUser, UpsertUserVariables } from '@dataconnect/generated';

// The `UpsertUser` mutation requires an argument of type `UpsertUserVariables`:
const upsertUserVars: UpsertUserVariables = {
  displayName: ..., 
};

// Call the `upsertUser()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await upsertUser(upsertUserVars);
// Variables can be defined inline as well.
const { data } = await upsertUser({ displayName: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await upsertUser(dataConnect, upsertUserVars);

console.log(data.user_upsert);

// Or, you can use the `Promise` API.
upsertUser(upsertUserVars).then((response) => {
  const data = response.data;
  console.log(data.user_upsert);
});
```

### Using `UpsertUser`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, upsertUserRef, UpsertUserVariables } from '@dataconnect/generated';

// The `UpsertUser` mutation requires an argument of type `UpsertUserVariables`:
const upsertUserVars: UpsertUserVariables = {
  displayName: ..., 
};

// Call the `upsertUserRef()` function to get a reference to the mutation.
const ref = upsertUserRef(upsertUserVars);
// Variables can be defined inline as well.
const ref = upsertUserRef({ displayName: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = upsertUserRef(dataConnect, upsertUserVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.user_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.user_upsert);
});
```

## AddCardToInventory
You can execute the `AddCardToInventory` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addCardToInventory(vars: AddCardToInventoryVariables): MutationPromise<AddCardToInventoryData, AddCardToInventoryVariables>;

interface AddCardToInventoryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddCardToInventoryVariables): MutationRef<AddCardToInventoryData, AddCardToInventoryVariables>;
}
export const addCardToInventoryRef: AddCardToInventoryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addCardToInventory(dc: DataConnect, vars: AddCardToInventoryVariables): MutationPromise<AddCardToInventoryData, AddCardToInventoryVariables>;

interface AddCardToInventoryRef {
  ...
  (dc: DataConnect, vars: AddCardToInventoryVariables): MutationRef<AddCardToInventoryData, AddCardToInventoryVariables>;
}
export const addCardToInventoryRef: AddCardToInventoryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addCardToInventoryRef:
```typescript
const name = addCardToInventoryRef.operationName;
console.log(name);
```

### Variables
The `AddCardToInventory` mutation requires an argument of type `AddCardToInventoryVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AddCardToInventoryVariables {
  cardId: UUIDString;
  quantity: number;
  condition: string;
}
```
### Return Type
Recall that executing the `AddCardToInventory` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddCardToInventoryData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddCardToInventoryData {
  userCard_upsert: UserCard_Key;
}
```
### Using `AddCardToInventory`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addCardToInventory, AddCardToInventoryVariables } from '@dataconnect/generated';

// The `AddCardToInventory` mutation requires an argument of type `AddCardToInventoryVariables`:
const addCardToInventoryVars: AddCardToInventoryVariables = {
  cardId: ..., 
  quantity: ..., 
  condition: ..., 
};

// Call the `addCardToInventory()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addCardToInventory(addCardToInventoryVars);
// Variables can be defined inline as well.
const { data } = await addCardToInventory({ cardId: ..., quantity: ..., condition: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addCardToInventory(dataConnect, addCardToInventoryVars);

console.log(data.userCard_upsert);

// Or, you can use the `Promise` API.
addCardToInventory(addCardToInventoryVars).then((response) => {
  const data = response.data;
  console.log(data.userCard_upsert);
});
```

### Using `AddCardToInventory`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addCardToInventoryRef, AddCardToInventoryVariables } from '@dataconnect/generated';

// The `AddCardToInventory` mutation requires an argument of type `AddCardToInventoryVariables`:
const addCardToInventoryVars: AddCardToInventoryVariables = {
  cardId: ..., 
  quantity: ..., 
  condition: ..., 
};

// Call the `addCardToInventoryRef()` function to get a reference to the mutation.
const ref = addCardToInventoryRef(addCardToInventoryVars);
// Variables can be defined inline as well.
const ref = addCardToInventoryRef({ cardId: ..., quantity: ..., condition: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addCardToInventoryRef(dataConnect, addCardToInventoryVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.userCard_upsert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.userCard_upsert);
});
```

## RemoveCardFromInventory
You can execute the `RemoveCardFromInventory` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
removeCardFromInventory(vars: RemoveCardFromInventoryVariables): MutationPromise<RemoveCardFromInventoryData, RemoveCardFromInventoryVariables>;

interface RemoveCardFromInventoryRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: RemoveCardFromInventoryVariables): MutationRef<RemoveCardFromInventoryData, RemoveCardFromInventoryVariables>;
}
export const removeCardFromInventoryRef: RemoveCardFromInventoryRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
removeCardFromInventory(dc: DataConnect, vars: RemoveCardFromInventoryVariables): MutationPromise<RemoveCardFromInventoryData, RemoveCardFromInventoryVariables>;

interface RemoveCardFromInventoryRef {
  ...
  (dc: DataConnect, vars: RemoveCardFromInventoryVariables): MutationRef<RemoveCardFromInventoryData, RemoveCardFromInventoryVariables>;
}
export const removeCardFromInventoryRef: RemoveCardFromInventoryRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the removeCardFromInventoryRef:
```typescript
const name = removeCardFromInventoryRef.operationName;
console.log(name);
```

### Variables
The `RemoveCardFromInventory` mutation requires an argument of type `RemoveCardFromInventoryVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface RemoveCardFromInventoryVariables {
  cardId: UUIDString;
}
```
### Return Type
Recall that executing the `RemoveCardFromInventory` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `RemoveCardFromInventoryData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface RemoveCardFromInventoryData {
  userCard_delete?: UserCard_Key | null;
}
```
### Using `RemoveCardFromInventory`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, removeCardFromInventory, RemoveCardFromInventoryVariables } from '@dataconnect/generated';

// The `RemoveCardFromInventory` mutation requires an argument of type `RemoveCardFromInventoryVariables`:
const removeCardFromInventoryVars: RemoveCardFromInventoryVariables = {
  cardId: ..., 
};

// Call the `removeCardFromInventory()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await removeCardFromInventory(removeCardFromInventoryVars);
// Variables can be defined inline as well.
const { data } = await removeCardFromInventory({ cardId: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await removeCardFromInventory(dataConnect, removeCardFromInventoryVars);

console.log(data.userCard_delete);

// Or, you can use the `Promise` API.
removeCardFromInventory(removeCardFromInventoryVars).then((response) => {
  const data = response.data;
  console.log(data.userCard_delete);
});
```

### Using `RemoveCardFromInventory`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, removeCardFromInventoryRef, RemoveCardFromInventoryVariables } from '@dataconnect/generated';

// The `RemoveCardFromInventory` mutation requires an argument of type `RemoveCardFromInventoryVariables`:
const removeCardFromInventoryVars: RemoveCardFromInventoryVariables = {
  cardId: ..., 
};

// Call the `removeCardFromInventoryRef()` function to get a reference to the mutation.
const ref = removeCardFromInventoryRef(removeCardFromInventoryVars);
// Variables can be defined inline as well.
const ref = removeCardFromInventoryRef({ cardId: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = removeCardFromInventoryRef(dataConnect, removeCardFromInventoryVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.userCard_delete);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.userCard_delete);
});
```

## CreateNewBinder
You can execute the `CreateNewBinder` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
createNewBinder(vars: CreateNewBinderVariables): MutationPromise<CreateNewBinderData, CreateNewBinderVariables>;

interface CreateNewBinderRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: CreateNewBinderVariables): MutationRef<CreateNewBinderData, CreateNewBinderVariables>;
}
export const createNewBinderRef: CreateNewBinderRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
createNewBinder(dc: DataConnect, vars: CreateNewBinderVariables): MutationPromise<CreateNewBinderData, CreateNewBinderVariables>;

interface CreateNewBinderRef {
  ...
  (dc: DataConnect, vars: CreateNewBinderVariables): MutationRef<CreateNewBinderData, CreateNewBinderVariables>;
}
export const createNewBinderRef: CreateNewBinderRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the createNewBinderRef:
```typescript
const name = createNewBinderRef.operationName;
console.log(name);
```

### Variables
The `CreateNewBinder` mutation requires an argument of type `CreateNewBinderVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface CreateNewBinderVariables {
  binderName: string;
  isPublic: boolean;
  description?: string | null;
}
```
### Return Type
Recall that executing the `CreateNewBinder` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `CreateNewBinderData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface CreateNewBinderData {
  binder_insert: Binder_Key;
}
```
### Using `CreateNewBinder`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, createNewBinder, CreateNewBinderVariables } from '@dataconnect/generated';

// The `CreateNewBinder` mutation requires an argument of type `CreateNewBinderVariables`:
const createNewBinderVars: CreateNewBinderVariables = {
  binderName: ..., 
  isPublic: ..., 
  description: ..., // optional
};

// Call the `createNewBinder()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await createNewBinder(createNewBinderVars);
// Variables can be defined inline as well.
const { data } = await createNewBinder({ binderName: ..., isPublic: ..., description: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await createNewBinder(dataConnect, createNewBinderVars);

console.log(data.binder_insert);

// Or, you can use the `Promise` API.
createNewBinder(createNewBinderVars).then((response) => {
  const data = response.data;
  console.log(data.binder_insert);
});
```

### Using `CreateNewBinder`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, createNewBinderRef, CreateNewBinderVariables } from '@dataconnect/generated';

// The `CreateNewBinder` mutation requires an argument of type `CreateNewBinderVariables`:
const createNewBinderVars: CreateNewBinderVariables = {
  binderName: ..., 
  isPublic: ..., 
  description: ..., // optional
};

// Call the `createNewBinderRef()` function to get a reference to the mutation.
const ref = createNewBinderRef(createNewBinderVars);
// Variables can be defined inline as well.
const ref = createNewBinderRef({ binderName: ..., isPublic: ..., description: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = createNewBinderRef(dataConnect, createNewBinderVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.binder_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.binder_insert);
});
```

## AddCardToUserCollection
You can execute the `AddCardToUserCollection` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [dataconnect-generated/index.d.ts](./index.d.ts):
```typescript
addCardToUserCollection(vars: AddCardToUserCollectionVariables): MutationPromise<AddCardToUserCollectionData, AddCardToUserCollectionVariables>;

interface AddCardToUserCollectionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AddCardToUserCollectionVariables): MutationRef<AddCardToUserCollectionData, AddCardToUserCollectionVariables>;
}
export const addCardToUserCollectionRef: AddCardToUserCollectionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
addCardToUserCollection(dc: DataConnect, vars: AddCardToUserCollectionVariables): MutationPromise<AddCardToUserCollectionData, AddCardToUserCollectionVariables>;

interface AddCardToUserCollectionRef {
  ...
  (dc: DataConnect, vars: AddCardToUserCollectionVariables): MutationRef<AddCardToUserCollectionData, AddCardToUserCollectionVariables>;
}
export const addCardToUserCollectionRef: AddCardToUserCollectionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the addCardToUserCollectionRef:
```typescript
const name = addCardToUserCollectionRef.operationName;
console.log(name);
```

### Variables
The `AddCardToUserCollection` mutation requires an argument of type `AddCardToUserCollectionVariables`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:

```typescript
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
```
### Return Type
Recall that executing the `AddCardToUserCollection` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AddCardToUserCollectionData`, which is defined in [dataconnect-generated/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AddCardToUserCollectionData {
  userCard_insert: UserCard_Key;
}
```
### Using `AddCardToUserCollection`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, addCardToUserCollection, AddCardToUserCollectionVariables } from '@dataconnect/generated';

// The `AddCardToUserCollection` mutation requires an argument of type `AddCardToUserCollectionVariables`:
const addCardToUserCollectionVars: AddCardToUserCollectionVariables = {
  cardId: ..., 
  quantity: ..., 
  condition: ..., 
  acquiredAt: ..., 
  pricePaid: ..., // optional
  notes: ..., // optional
  isForTrade: ..., // optional
  isForSale: ..., // optional
};

// Call the `addCardToUserCollection()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await addCardToUserCollection(addCardToUserCollectionVars);
// Variables can be defined inline as well.
const { data } = await addCardToUserCollection({ cardId: ..., quantity: ..., condition: ..., acquiredAt: ..., pricePaid: ..., notes: ..., isForTrade: ..., isForSale: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await addCardToUserCollection(dataConnect, addCardToUserCollectionVars);

console.log(data.userCard_insert);

// Or, you can use the `Promise` API.
addCardToUserCollection(addCardToUserCollectionVars).then((response) => {
  const data = response.data;
  console.log(data.userCard_insert);
});
```

### Using `AddCardToUserCollection`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, addCardToUserCollectionRef, AddCardToUserCollectionVariables } from '@dataconnect/generated';

// The `AddCardToUserCollection` mutation requires an argument of type `AddCardToUserCollectionVariables`:
const addCardToUserCollectionVars: AddCardToUserCollectionVariables = {
  cardId: ..., 
  quantity: ..., 
  condition: ..., 
  acquiredAt: ..., 
  pricePaid: ..., // optional
  notes: ..., // optional
  isForTrade: ..., // optional
  isForSale: ..., // optional
};

// Call the `addCardToUserCollectionRef()` function to get a reference to the mutation.
const ref = addCardToUserCollectionRef(addCardToUserCollectionVars);
// Variables can be defined inline as well.
const ref = addCardToUserCollectionRef({ cardId: ..., quantity: ..., condition: ..., acquiredAt: ..., pricePaid: ..., notes: ..., isForTrade: ..., isForSale: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = addCardToUserCollectionRef(dataConnect, addCardToUserCollectionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.userCard_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.userCard_insert);
});
```

