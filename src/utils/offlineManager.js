import AsyncStorage from "@react-native-async-storage/async-storage"
import NetInfo from "@react-native-community/netinfo"
import { database } from "../config/firebaseConfig"
import { ref, set, push, query, orderByChild, equalTo, get, update } from "firebase/database"

const OFFLINE_APONTAMENTOS_KEY = "@offline_apontamentos"
const OFFLINE_ABASTECIMENTOS_KEY = "@offline_abastecimentos"
const OFFLINE_PERCURSOS_KEY = "@offline_percursos"
const CACHED_MAQUINARIOS_KEY = "@cached_maquinarios"
const CACHED_IMPLEMENTOS_KEY = "@cached_implementos"
const CACHED_VEICULOS_KEY = "@cached_veiculos"
const CACHED_DIRECIONADORES_KEY = "@cached_direcionadores"
const CACHED_USERS_KEY = "@cached_users"
const CACHED_HORIMETROS_KEY = "@cached_horimetros"

export const saveOfflineData = async (data, storageKey = OFFLINE_APONTAMENTOS_KEY) => {
  try {
    const existingData = await AsyncStorage.getItem(storageKey)
    const offlineData = existingData ? JSON.parse(existingData) : []

    const isDuplicate = offlineData.some((item) => item.localId === data.localId)

    if (!isDuplicate) {
      offlineData.push(data)
      await AsyncStorage.setItem(storageKey, JSON.stringify(offlineData))
      console.log(`Dados offline salvos com sucesso em ${storageKey}:`, data.localId)
    } else {
      console.log(`Dados duplicados detectados em ${storageKey}, não salvando:`, data.localId)
    }
  } catch (error) {
    console.error(`Erro ao salvar dados offline em ${storageKey}:`, error)
  }
}

export const syncOfflineApontamentos = async () => {
  try {
    const offlineData = await AsyncStorage.getItem(OFFLINE_APONTAMENTOS_KEY)
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

            await set(newEntryRef, {
              ...apontamentoData,
              localId,
              status: "synced",

              operacoesMecanizadas: apontamentoData.operacoesMecanizadas || [],
            })
            console.log("Apontamento sincronizado com sucesso:", localId)

            if (apontamentoData.operacoesMecanizadas && apontamentoData.operacoesMecanizadas.length > 0) {
              const horimetrosRef = ref(database, `propriedades/${propriedade}/horimetros`)
              const horimetrosSnapshot = await get(horimetrosRef)
              const horimetrosData = horimetrosSnapshot.val() || {}

              const updatedHorimetros = { ...horimetrosData }

              apontamentoData.operacoesMecanizadas.forEach((op) => {
                const bemId = op.bem.split(" - ")[0]
                if (op.horaFinal) {
                  updatedHorimetros[bemId] = op.horaFinal
                }
              })

              await update(horimetrosRef, updatedHorimetros)
              console.log("Horímetros atualizados com sucesso")
            }
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
          console.error("Erro ao sincronizar apontamento individual:", error)
          remainingData.push(data)
        }
      }

      if (remainingData.length > 0) {
        await AsyncStorage.setItem(OFFLINE_APONTAMENTOS_KEY, JSON.stringify(remainingData))
      } else {
        await AsyncStorage.removeItem(OFFLINE_APONTAMENTOS_KEY)
      }
    }
  } catch (error) {
    console.error("Erro ao sincronizar apontamentos offline:", error)
  }
}

export const syncOfflineAbastecimentos = async () => {
  try {
    const offlineData = await AsyncStorage.getItem(OFFLINE_ABASTECIMENTOS_KEY)
    if (offlineData) {
      const parsedData = JSON.parse(offlineData)
      const remainingData = []

      for (const data of parsedData) {
        try {
          const { propriedade, localId, ...abastecimentoData } = data

          const nodePath =
            data.tipoEquipamento === "veiculo"
              ? `propriedades/${propriedade}/abastecimentoVeiculos`
              : `propriedades/${propriedade}/abastecimentos`

          const abastecimentosRef = ref(database, nodePath)
          const existingEntryQuery = query(abastecimentosRef, orderByChild("localId"), equalTo(localId))
          const existingEntrySnapshot = await get(existingEntryQuery)

          if (!existingEntrySnapshot.exists()) {
            const newEntryRef = push(abastecimentosRef)
            await set(newEntryRef, { ...abastecimentoData, localId, status: "synced" })
            console.log("Abastecimento sincronizado com sucesso:", localId)
          } else {
            const existingEntry = Object.values(existingEntrySnapshot.val())[0]
            if (existingEntry.status === "pending") {
              const existingEntryKey = Object.keys(existingEntrySnapshot.val())[0]
              await update(ref(database, `${nodePath}/${existingEntryKey}`), {
                status: "synced",
              })
              console.log("Status do abastecimento atualizado:", localId)
            } else {
              console.log("Abastecimento já sincronizado, ignorando:", localId)
            }
          }
        } catch (error) {
          console.error("Erro ao sincronizar abastecimento individual:", error)
          remainingData.push(data)
        }
      }

      if (remainingData.length > 0) {
        await AsyncStorage.setItem(OFFLINE_ABASTECIMENTOS_KEY, JSON.stringify(remainingData))
      } else {
        await AsyncStorage.removeItem(OFFLINE_ABASTECIMENTOS_KEY)
      }
    }
  } catch (error) {
    console.error("Erro ao sincronizar abastecimentos offline:", error)
  }
}

export const syncOfflinePercursos = async () => {
  try {
    const offlineData = await AsyncStorage.getItem(OFFLINE_PERCURSOS_KEY)
    if (offlineData) {
      const parsedData = JSON.parse(offlineData)
      const remainingData = []

      for (const data of parsedData) {
        try {
          const { propriedade, localId, ...percursoData } = data

          const percursosRef = ref(database, `propriedades/${propriedade}/percursos`)
          const existingEntryQuery = query(percursosRef, orderByChild("localId"), equalTo(localId))
          const existingEntrySnapshot = await get(existingEntryQuery)

          if (!existingEntrySnapshot.exists()) {
            const newEntryRef = push(percursosRef)
            await set(newEntryRef, { ...percursoData, localId, status: "synced" })
            console.log("Percurso sincronizado com sucesso:", localId)
          } else {
            const existingEntry = Object.values(existingEntrySnapshot.val())[0]
            if (existingEntry.status === "pending") {
              const existingEntryKey = Object.keys(existingEntrySnapshot.val())[0]
              await update(ref(database, `propriedades/${propriedade}/percursos/${existingEntryKey}`), {
                status: "synced",
              })
              console.log("Status do percurso atualizado:", localId)
            } else {
              console.log("Percurso já sincronizado, ignorando:", localId)
            }
          }
        } catch (error) {
          console.error("Erro ao sincronizar percurso individual:", error)
          remainingData.push(data)
        }
      }

      if (remainingData.length > 0) {
        await AsyncStorage.setItem(OFFLINE_PERCURSOS_KEY, JSON.stringify(remainingData))
      } else {
        await AsyncStorage.removeItem(OFFLINE_PERCURSOS_KEY)
      }
    }
  } catch (error) {
    console.error("Erro ao sincronizar percursos offline:", error)
  }
}

export const cacheFirebaseData = async (data, cacheKey) => {
  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify(data))
    console.log(`Dados em cache salvos com sucesso em ${cacheKey}`)
  } catch (error) {
    console.error(`Erro ao salvar dados em cache em ${cacheKey}:`, error)
  }
}

export const getCachedData = async (cacheKey) => {
  try {
    const cachedData = await AsyncStorage.getItem(cacheKey)
    return cachedData ? JSON.parse(cachedData) : null
  } catch (error) {
    console.error(`Erro ao obter dados em cache de ${cacheKey}:`, error)
    return null
  }
}

export const syncAllOfflineData = async () => {
  await syncOfflineApontamentos()
  await syncOfflineAbastecimentos()
  await syncOfflinePercursos()
}

let isSyncingInProgress = false

export const checkConnectivityAndSync = async () => {
  if (isSyncingInProgress) {
    console.log("Sincronização já em andamento, pulando")
    return
  }

  try {
    isSyncingInProgress = true
    const netInfo = await NetInfo.fetch()
    if (netInfo.isConnected) {
      await syncAllOfflineData()
    }
  } finally {
    isSyncingInProgress = false
  }
}

export const CACHE_KEYS = {
  MAQUINARIOS: CACHED_MAQUINARIOS_KEY,
  IMPLEMENTOS: CACHED_IMPLEMENTOS_KEY,
  VEICULOS: CACHED_VEICULOS_KEY,
  DIRECIONADORES: CACHED_DIRECIONADORES_KEY,
  USERS: CACHED_USERS_KEY,
  HORIMETROS: CACHED_HORIMETROS_KEY,
}
