import { View, Alert, SafeAreaView } from "react-native"
import { useNavigation } from "@react-navigation/native"
import RegisterForm from "../components/RegisterForm"
import { auth, database } from "../config/firebaseConfig"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { ref, set, remove } from "firebase/database"
import { LinearGradient } from "expo-linear-gradient"
import styles from "../styles/StyleRegister"

export default function RegisterScreen() {
  const navigation = useNavigation()

  const handleRegister = async (email, password, name, role, propriedade) => {
    try {
      console.log("Dados recebidos:", { email, password, name, role, propriedade })

      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user


      const userData = {
        nome: name,
        email: email,
        role: role,
        propriedade: propriedade, 
      }

      console.log("Dados a serem salvos:", userData)


      await set(ref(database, `users/${user.uid}`), {
        ...userData,
        propriedade_escolhida: propriedade,
      })

   
      await set(ref(database, `propriedades/${propriedade}/users/${user.uid}`), userData)

      console.log("Dados salvos com sucesso")

 
      await remove(ref(database, `${user.uid}`))

      Alert.alert("Conta Criada!", "Sua conta foi criada com sucesso!", [
        { text: "OK", onPress: () => navigation.navigate("Home") },
      ])
    } catch (error) {
      console.error("Erro ao registrar:", error)
      if (error.code === "auth/email-already-in-use") {
        Alert.alert("E-mail já cadastrado", "Este e-mail já foi cadastrado. Por favor, use outro e-mail ou faça login.")
      } else {
        Alert.alert("Erro!", error.message)
      }
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#4c669f", "#3b5998", "#192f6a"]} style={styles.gradientBackground}>
        <View style={styles.overlay}>
          <View style={styles.container}>
            <RegisterForm onRegister={handleRegister} />
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  )
}

