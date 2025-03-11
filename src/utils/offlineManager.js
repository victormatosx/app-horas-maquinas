import AsyncStorage from "@react-native-async-storage/async-storage"
import NetInfo from "@react-native-community/netinfo"
import { database } from "../config/firebaseConfig"
import { ref, set, push, query, orderByChild, equalTo, get, update } from "firebase/database"

const OFFLINE_STORAGE_KEY = "@offline_data"

// Modify the saveOfflineData function to prevent duplicates
export const saveOfflineData = async (data) => {
  try {
    const existingData = await AsyncStorage.getItem(OFFLINE_STORAGE_KEY)
    const offlineData = existingData ? JSON.parse(existingData) : []

    // Check if an entry with the same localId already exists
    const isDuplicate = offlineData.some((item) => item.localId === data.localId)

    if (!isDuplicate) {
      offlineData.push(data)
      await AsyncStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(offlineData))
      console.log("Offline data saved successfully:", data.localId)
    } else {
      console.log("Duplicate offline data detected, not saving:", data.localId)
    }
  } catch (error) {
    console.error("Error saving offline data:", error)
  }
}

export const syncOfflineData = async () => {
  try {
    const offlineData = await AsyncStorage.getItem(OFFLINE_STORAGE_KEY)
    if (offlineData) {
      const parsedData = JSON.parse(offlineData)
      const remainingData = []

      for (const data of parsedData) {
        try {
          const { propriedade, localId, ...apontamentoData } = data

          const apontamentosRef = ref(database, `propriedades/${propriedade}/apontamentos`)
          const existingEntryQuery = query(apontamentosRef, orderByChild("localId"), equalTo(localId))
          const existingEntrySnapshot = await get(existingEntryQuery)

          if (!existingEntrySnapshot.exists()) {
            const newEntryRef = push(apontamentosRef)
            await set(newEntryRef, { ...apontamentoData, localId, status: "synced" })
            console.log("Apontamento sincronizado com sucesso:", localId)
          } else {
            const existingEntry = Object.values(existingEntrySnapshot.val())[0]
            if (existingEntry.status === "pending") {
              const existingEntryKey = Object.keys(existingEntrySnapshot.val())[0]
              await update(ref(database, `propriedades/${propriedade}/apontamentos/${existingEntryKey}`), {
                status: "synced",
              })
              console.log("Status do apontamento atualizado:", localId)
            } else {
              console.log("Apontamento já sincronizado, ignorando:", localId)
            }
          }
        } catch (error) {
          console.error("Error syncing individual offline data:", error)
          remainingData.push(data)
        }
      }

      if (remainingData.length > 0) {
        await AsyncStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(remainingData))
      } else {
        await AsyncStorage.removeItem(OFFLINE_STORAGE_KEY)
      }
    }
  } catch (error) {
    console.error("Error syncing offline data:", error)
  }
}

// Modify the checkConnectivityAndSync function to use a lock mechanism
let isSyncingInProgress = false

export const checkConnectivityAndSync = async () => {
  if (isSyncingInProgress) {
    console.log("Sync already in progress, skipping")
    return
  }

  try {
    isSyncingInProgress = true
    const netInfo = await NetInfo.fetch()
    if (netInfo.isConnected) {
      await syncOfflineData()
    }
  } finally {
    isSyncingInProgress = false
  }
}

