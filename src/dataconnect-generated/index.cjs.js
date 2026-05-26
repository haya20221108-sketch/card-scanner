const { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'example',
  service: 'card-scanner-1',
  location: 'us-east4'
};
exports.connectorConfig = connectorConfig;

const createCardRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateCard', inputVars);
}
createCardRef.operationName = 'CreateCard';
exports.createCardRef = createCardRef;

exports.createCard = function createCard(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createCardRef(dcInstance, inputVars));
}
;

const upsertUserRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'UpsertUser', inputVars);
}
upsertUserRef.operationName = 'UpsertUser';
exports.upsertUserRef = upsertUserRef;

exports.upsertUser = function upsertUser(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(upsertUserRef(dcInstance, inputVars));
}
;

const addCardToInventoryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddCardToInventory', inputVars);
}
addCardToInventoryRef.operationName = 'AddCardToInventory';
exports.addCardToInventoryRef = addCardToInventoryRef;

exports.addCardToInventory = function addCardToInventory(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(addCardToInventoryRef(dcInstance, inputVars));
}
;

const removeCardFromInventoryRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'RemoveCardFromInventory', inputVars);
}
removeCardFromInventoryRef.operationName = 'RemoveCardFromInventory';
exports.removeCardFromInventoryRef = removeCardFromInventoryRef;

exports.removeCardFromInventory = function removeCardFromInventory(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(removeCardFromInventoryRef(dcInstance, inputVars));
}
;

const getMyBindersRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetMyBinders');
}
getMyBindersRef.operationName = 'GetMyBinders';
exports.getMyBindersRef = getMyBindersRef;

exports.getMyBinders = function getMyBinders(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(getMyBindersRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}
;

const createNewBinderRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'CreateNewBinder', inputVars);
}
createNewBinderRef.operationName = 'CreateNewBinder';
exports.createNewBinderRef = createNewBinderRef;

exports.createNewBinder = function createNewBinder(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(createNewBinderRef(dcInstance, inputVars));
}
;

const getCardDetailsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'GetCardDetails', inputVars);
}
getCardDetailsRef.operationName = 'GetCardDetails';
exports.getCardDetailsRef = getCardDetailsRef;

exports.getCardDetails = function getCardDetails(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(getCardDetailsRef(dcInstance, inputVars), inputOpts && inputOpts.fetchPolicy);
}
;

const addCardToUserCollectionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AddCardToUserCollection', inputVars);
}
addCardToUserCollectionRef.operationName = 'AddCardToUserCollection';
exports.addCardToUserCollectionRef = addCardToUserCollectionRef;

exports.addCardToUserCollection = function addCardToUserCollection(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(addCardToUserCollectionRef(dcInstance, inputVars));
}
;
