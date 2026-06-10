import { getFunctions, httpsCallable } from 'firebase/functions'
import app from './firebase'

const functions = getFunctions(app, 'us-central1')

export const getDeliveryQuote = httpsCallable(functions, 'doordashQuote')
export const dispatchDelivery = httpsCallable(functions, 'doordashDispatch')
