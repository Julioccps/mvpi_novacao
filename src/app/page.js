"use client";

import Image from "next/image";
import styles from "./page.module.css";
import './globals.css';

import { useRef, useState, useEffect } from 'react'; // Adicione useEffect
import { useAuthState } from 'react-firebase-hooks/auth';
import { useCollectionData } from 'react-firebase-hooks/firestore';

// Importa do Firebase modular
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
// CORREÇÃO: Importar addDoc e serverTimestamp
import { getFirestore, collection, query, orderBy, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Configuração do Firebase (Mantenha em variáveis de ambiente por segurança)
const firebaseConfig = {
  apiKey: "AIzaSyDXaJ4qcCAbLEC6qX_2lZ69jEJxXONvu6c", // Considere usar .env.local
  authDomain: "youcare-3171d.firebaseapp.com",
  projectId: "youcare-3171d",
  storageBucket: "youcare-3171d.firebasestorage.app",
  messagingSenderId: "76440144631",
  appId: "1:76440144631:web:01f29a9de0e4a7fa9fa1f2",
  measurementId: "G-VC2YFSMQPR"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestore = getFirestore(app);

// Analytics (opcional)
let analytics;
isSupported().then(supported => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});

// Componente principal
function App() {
  const [user] = useAuthState(auth);
  // NOVO: Estado para garantir a renderização apenas no cliente
  const [isClient, setIsClient] = useState(false);

  // NOVO: useEffect só roda no cliente.
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Se ainda não estivermos no cliente, não renderize nada para evitar o erro.
  if (!isClient) {
    return null;
  }

  // Quando isClient for true, o componente será renderizado no cliente.
  return (
    <div className="App">
      <header>
        <h1>YouCare</h1>
        <SignOut />
      </header>

      <section>
        {user ? <ChatRoom /> : <SignIn />}
      </section>
    </div>
  );
}

function SignIn() {
  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  return (
    <>
      <button className="sign-in" onClick={signInWithGoogle}>Logar com conta Google</button>
      <p>Chatbot da YouCare para agendar consultas médicas.</p>
    </>
  );
}

function SignOut() {
  return auth.currentUser && (
    <button className="sign-out" onClick={() => signOut(auth)}>Sair da conta Google</button>
  );
}

function ChatRoom() {
  const dummy = useRef();
  const { uid } = auth.currentUser; // NOVO: Pega o UID do usuário logado

  // MUDANÇA: A referência agora aponta para a subcoleção de mensagens do usuário
  const messagesRef = collection(firestore, 'user_chats', uid, 'messages');
  const messagesQuery = query(messagesRef, orderBy('createdAt'), limit(100)); // Aumentei o limite para ver mais mensagens
  
  const [messages] = useCollectionData(messagesQuery, { idField: 'id' });
  const [formValue, setFormValue] = useState('');

  // Função para enviar mensagens (tanto do usuário quanto do bot)
  const addMessage = async (text, messageUid, photoURL) => {
    // CORREÇÃO: Usa addDoc e serverTimestamp() da v9
    await addDoc(messagesRef, {
      text,
      createdAt: serverTimestamp(),
      uid: messageUid,
      photoURL,
    });
  };

  const sendMessage = async (e) => {
    e.preventDefault();

    const { uid, photoURL } = auth.currentUser;
    const messageText = formValue.trim();
    
    if (messageText === '') return;

    // 1. Adiciona a mensagem do usuário
    await addMessage(messageText, uid, photoURL);
    setFormValue(''); // Limpa o input imediatamente

    // 2. Processa comandos e envia resposta do bot
    if (messageText === '/help' || messageText === '/ajuda') {
      await addMessage(
        "Comandos disponíveis:\n/help ou /ajuda - Mostrar esta ajuda\n/agendar - Agendar um atendimento\n/consulta - Consultar o status de um agendamento",
        'bot',
        'https://imgur.com/a/FAWlyDb' // Use um URL de imagem acessível publicamente
      );
    } else if (messageText === '/agendar') {
      await addMessage(
        "Agendamento solicitado! Em breve nossa equipe entrará em contato para confirmar os detalhes.",
        'bot',
        'https://imgur.com/a/FAWlyDb'
      );
      // Salva a solicitação em uma coleção separada
      const solicitacoesRef = collection(firestore, 'solicitacoes');
      // CORREÇÃO: Usa addDoc e serverTimestamp()
      await addDoc(solicitacoesRef, {
        tipo: 'agendamento',
        criadoEm: serverTimestamp(),
        usuario: uid
      });
    } else if (messageText === '/consulta') {
      await addMessage(
        "Consulta de status registrada! Estamos verificando seus agendamentos e retornaremos em breve.",
        'bot',
        'https://imgur.com/a/FAWlyDb'
      );
      const solicitacoesRef = collection(firestore, 'solicitacoes');
      // CORREÇÃO: Usa addDoc e serverTimestamp()
      await addDoc(solicitacoesRef, {
        tipo: 'consulta',
        criadoEm: serverTimestamp(),
        usuario: uid
      });
    }
  };

  // Faz a página rolar para a última mensagem
  useEffect(() => {
    if (dummy.current) {
      dummy.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);


  return (
    <>
      <main>
        {messages && messages.map(msg => <ChatMessage key={msg.id} message={msg} />)}
        <span ref={dummy}></span>
      </main>

      <form onSubmit={sendMessage}>
        <input value={formValue} onChange={(e) => setFormValue(e.target.value)} placeholder="Digite /ajuda para começar" />
        <button type="submit" disabled={!formValue}>🕊️</button>
      </form>
    </>
  );
}

function ChatMessage(props) {
  const { text, uid, photoURL } = props.message;
  // A classe da mensagem é definida com base no UID
  const messageClass = uid === auth.currentUser.uid
    ? 'sent'
    : uid === 'bot'
      ? 'bot'
      : 'received'; // 'received' não será usado neste modelo de chatbot, mas é bom ter

  return (
    <div className={`message ${messageClass}`}>
      <img src={photoURL || 'https://api.adorable.io/avatars/23/abott@adorable.png'} alt="Avatar" />
      {/* Usando <pre> para manter as quebras de linha do texto de ajuda */}
      <pre>{text}</pre>
    </div>
  );
}

export default App;