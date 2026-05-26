# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.




### React
For each operation, there is a wrapper hook that can be used to call the operation.

Here are all of the hooks that get generated:
```ts
import { useCreateCard, useUpsertUser, useAddCardToInventory, useRemoveCardFromInventory, useGetMyBinders, useCreateNewBinder, useGetCardDetails, useAddCardToUserCollection } from '@dataconnect/generated/react';
// The types of these hooks are available in react/index.d.ts

const { data, isPending, isSuccess, isError, error } = useCreateCard(createCardVars);

const { data, isPending, isSuccess, isError, error } = useUpsertUser(upsertUserVars);

const { data, isPending, isSuccess, isError, error } = useAddCardToInventory(addCardToInventoryVars);

const { data, isPending, isSuccess, isError, error } = useRemoveCardFromInventory(removeCardFromInventoryVars);

const { data, isPending, isSuccess, isError, error } = useGetMyBinders();

const { data, isPending, isSuccess, isError, error } = useCreateNewBinder(createNewBinderVars);

const { data, isPending, isSuccess, isError, error } = useGetCardDetails(getCardDetailsVars);

const { data, isPending, isSuccess, isError, error } = useAddCardToUserCollection(addCardToUserCollectionVars);

```

Here's an example from a different generated SDK:

```ts
import { useListAllMovies } from '@dataconnect/generated/react';

function MyComponent() {
  const { isLoading, data, error } = useListAllMovies();
  if(isLoading) {
    return <div>Loading...</div>
  }
  if(error) {
    return <div> An Error Occurred: {error} </div>
  }
}

// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MyComponent from './my-component';

function App() {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>
    <MyComponent />
  </QueryClientProvider>
}
```



## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { createCard, upsertUser, addCardToInventory, removeCardFromInventory, getMyBinders, createNewBinder, getCardDetails, addCardToUserCollection } from '@dataconnect/generated';


// Operation CreateCard:  For variables, look at type CreateCardVars in ../index.d.ts
const { data } = await CreateCard(dataConnect, createCardVars);

// Operation UpsertUser:  For variables, look at type UpsertUserVars in ../index.d.ts
const { data } = await UpsertUser(dataConnect, upsertUserVars);

// Operation AddCardToInventory:  For variables, look at type AddCardToInventoryVars in ../index.d.ts
const { data } = await AddCardToInventory(dataConnect, addCardToInventoryVars);

// Operation RemoveCardFromInventory:  For variables, look at type RemoveCardFromInventoryVars in ../index.d.ts
const { data } = await RemoveCardFromInventory(dataConnect, removeCardFromInventoryVars);

// Operation GetMyBinders: 
const { data } = await GetMyBinders(dataConnect);

// Operation CreateNewBinder:  For variables, look at type CreateNewBinderVars in ../index.d.ts
const { data } = await CreateNewBinder(dataConnect, createNewBinderVars);

// Operation GetCardDetails:  For variables, look at type GetCardDetailsVars in ../index.d.ts
const { data } = await GetCardDetails(dataConnect, getCardDetailsVars);

// Operation AddCardToUserCollection:  For variables, look at type AddCardToUserCollectionVars in ../index.d.ts
const { data } = await AddCardToUserCollection(dataConnect, addCardToUserCollectionVars);


```