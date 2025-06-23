import { ref, get, set, update } from "firebase/database"
import { database } from "../config/firebaseConfig"

export class DatabaseUtils {
  // Verificar se usuário existe no database
  static async checkUserExists(userId) {
    try {
      const userRef = ref(database, `users/${userId}`)
      const snapshot = await get(userRef)
      return snapshot.exists()
    } catch (error) {
      console.error("Erro ao verificar usuário:", error)
      return false
    }
  }

  // Criar usuário no database
  static async createUser(user, additionalData = {}) {
    try {
      const userRef = ref(database, `users/${user.uid}`)
      const userData = {
        email: user.email,
        nome: user.displayName || user.email.split("@")[0],
        propriedade_escolhida: "Matrice", // Valor padrão
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
        ...additionalData,
      }

      await set(userRef, userData)
      return userData
    } catch (error) {
      console.error("Erro ao criar usuário:", error)
      throw error
    }
  }

  // Atualizar último login
  static async updateLastLogin(userId) {
    try {
      const userRef = ref(database, `users/${userId}`)
      await update(userRef, {
        last_login: new Date().toISOString(),
      })
    } catch (error) {
      console.error("Erro ao atualizar último login:", error)
    }
  }

  // Verificar e criar usuário na propriedade
  static async ensureUserInPropriedade(userId, propriedadeId, role = "user") {
    try {
      const propriedadeUserRef = ref(database, `propriedades/${propriedadeId}/users/${userId}`)
      const snapshot = await get(propriedadeUserRef)

      if (!snapshot.exists()) {
        const userData = {
          role: role,
          status: "active",
          added_at: new Date().toISOString(),
        }
        await set(propriedadeUserRef, userData)
        return userData
      }

      return snapshot.val()
    } catch (error) {
      console.error("Erro ao verificar usuário na propriedade:", error)
      throw error
    }
  }
}
