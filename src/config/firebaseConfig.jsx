// firebaseConfig.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

// Sua configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDT3GdvQqffxDtTkvRp9eZ73AFFo6rwPYQ",
  authDomain: "app-hora-maquina.firebaseapp.com", // Adicione o domínio de autenticação
  databaseURL: "https://app-hora-maquina-default-rtdb.firebaseio.com", // URL do Realtime Database
  projectId: "app-hora-maquina",
  storageBucket: "app-hora-maquina.appspot.com",
  messagingSenderId: "51002260602",
  appId: "1:51002260602:android:ada291da21d8b5ae2acfc3",
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Auth e o Database
const auth = getAuth(app);
const database = getDatabase(app);

// Exporta as instâncias
export { app, auth, database };

