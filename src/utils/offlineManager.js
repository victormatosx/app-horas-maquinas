import AsyncStorage from "@react-native-async-storage/async-storage"
import NetInfo from "@react-native-community/netinfo"
import { database } from "../config/firebaseConfig"
import { ref, set, push } from "firebase/database"
const OFFLINE_STORAGE_KEY = "@offline_data"
export const saveOfflineData = async (data) => {
  try {
    const existingData = await AsyncStorage.getItem(OFFLINE_STORAGE_KEY)
    const offlineData = existingData ? JSON.parse(existingData) : []
    offlineData.push(data)
    await AsyncStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(offlineData))
  } catch (error) {
    console.error("Error saving offline data:", error)
  }
}
export const syncOfflineData = async () => {
  try {
    const offlineData = await AsyncStorage.getItem(OFFLINE_STORAGE_KEY)
    if (offlineData) {
      const parsedData = JSON.parse(offlineData)
      for (const data of parsedData) {
        const { propriedade, ...apontamentoData } = data
        const apontamentosRef = ref(database, `propriedades/${propriedade}/apontamentos`)
        const newEntryRef = push(apontamentosRef)
        await set(newEntryRef, apontamentoData)
      }
      await AsyncStorage.removeItem(OFFLINE_STORAGE_KEY)
    }
  } catch (error) {
    console.error("Error syncing offline data:", error)
  }
}
export const checkConnectivityAndSync = async () => {
  const netInfo = await NetInfo.fetch()
  if (netInfo.isConnected) {
    await syncOfflineData()
  }
}

