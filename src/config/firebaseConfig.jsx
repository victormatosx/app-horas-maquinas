import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getDatabase } from "firebase/database"
const firebaseConfig = {
  apiKey: "AIzaSyDT3GdvQqffxDtTkvRp9eZ73AFFo6rwPYQ",
  authDomain: "app-hora-maquina.firebaseapp.com",
  databaseURL: "https://app-hora-maquina-default-rtdb.firebaseio.com",
  projectId: "app-hora-maquina",
  storageBucket: "app-hora-maquina.appspot.com",
  messagingSenderId: "51002260602",
  appId: "1:51002260602:android:ada291da21d8b5ae2acfc3",
}
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const database = getDatabase(app)
export { app, auth, database }

