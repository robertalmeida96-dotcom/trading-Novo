/*****************
 * firebase-config.js
 * Configuração e inicialização do Firebase
 * Dependências: Firebase SDK 9+
 *****************/

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, onSnapshot, collection, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configurações do Firebase - Trading Pro
const firebaseConfig = {
    apiKey: "AIzaSyClYFjupZIbDIGPA5Vns0QLvs4fFjj9dWs",
    authDomain: "trading-pro-96ca5.firebaseapp.com",
    databaseURL: "https://trading-pro-96ca5-default-rtdb.firebaseio.com",
    projectId: "trading-pro-96ca5",
    storageBucket: "trading-pro-96ca5.firebasestorage.app",
    messagingSenderId: "1022670871654",
    appId: "1:1022670871654:web:ad5325c469d6d61989e1a7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Estado de conexão
let isOnline = navigator.onLine;
let currentUser = null;

// Atualizar status de conexão
window.addEventListener('online', () => {
    isOnline = true;
    updateConnectionStatus(true);
});

window.addEventListener('offline', () => {
    isOnline = false;
    updateConnectionStatus(false);
});

// Função para atualizar indicador visual de conexão
function updateConnectionStatus(online) {
    const statusIndicator = document.getElementById('connection-status');
    if (statusIndicator) {
        statusIndicator.className = online ? 'status-online' : 'status-offline';
        statusIndicator.innerHTML = online ? 
            '<i class="fas fa-check-circle"></i> Online' : 
            '<i class="fas fa-exclamation-circle"></i> Offline';
    }
}

// Autenticação anônima automática
async function initAuth() {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                console.log('✅ Usuário autenticado:', user.uid);
                resolve(user);
            } else {
                try {
                    const userCredential = await signInAnonymously(auth);
                    currentUser = userCredential.user;
                    console.log('✅ Login anônimo realizado:', currentUser.uid);
                    resolve(currentUser);
                } catch (error) {
                    console.error('❌ Erro no login anônimo:', error);
                    reject(error);
                }
            }
        });
    });
}

// Salvar dados no Firestore
async function saveToFirebase(data) {
    if (!currentUser) {
        console.warn('⚠️ Usuário não autenticado. Salvando apenas no localStorage.');
        return false;
    }

    try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await setDoc(userDocRef, {
            userData: data,
            lastUpdated: new Date().toISOString(),
            deviceInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform
            }
        }, { merge: true });
        
        console.log('✅ Dados salvos no Firebase');
        return true;
    } catch (error) {
        console.error('❌ Erro ao salvar no Firebase:', error);
        return false;
    }
}

// Carregar dados do Firestore
async function loadFromFirebase() {
    if (!currentUser) {
        console.warn('⚠️ Usuário não autenticado');
        return null;
    }

    try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        
        if (docSnap.exists()) {
            console.log('✅ Dados carregados do Firebase');
            return docSnap.data().userData;
        } else {
            console.log('ℹ️ Nenhum dado encontrado no Firebase');
            return null;
        }
    } catch (error) {
        console.error('❌ Erro ao carregar do Firebase:', error);
        return null;
    }
}

// Sincronizar dados do localStorage com Firebase
async function syncData() {
    if (!isOnline || !currentUser) {
        console.log('⚠️ Sincronização adiada (offline ou não autenticado)');
        return;
    }

    try {
        // Carregar dados locais
        const localData = localStorage.getItem('tradingProData');
        
        if (localData) {
            const parsedData = JSON.parse(localData);
            await saveToFirebase(parsedData);
            console.log('✅ Sincronização completa');
        }
    } catch (error) {
        console.error('❌ Erro na sincronização:', error);
    }
}

// Listener em tempo real para mudanças no Firestore
function setupRealtimeSync() {
    if (!currentUser) return;

    const userDocRef = doc(db, 'users', currentUser.uid);
    
    onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            const firebaseData = doc.data().userData;
            const localData = localStorage.getItem('tradingProData');
            
            // Verificar se os dados do Firebase são diferentes dos locais
            if (JSON.stringify(firebaseData) !== localData) {
                console.log('🔄 Dados atualizados de outro dispositivo');
                localStorage.setItem('tradingProData', JSON.stringify(firebaseData));
                
                // Recarregar a página para atualizar a interface
                if (confirm('📱 Seus dados foram atualizados em outro dispositivo. Deseja recarregar a página?')) {
                    window.location.reload();
                }
            }
        }
    }, (error) => {
        console.error('❌ Erro no listener em tempo real:', error);
    });
}

// Migrar dados do localStorage para Firebase (primeira vez)
async function migrateToFirebase() {
    const localData = localStorage.getItem('tradingProData');
    
    if (localData && currentUser) {
        try {
            const firebaseData = await loadFromFirebase();
            
            if (!firebaseData) {
                // Primeira vez, migrar dados locais
                console.log('📦 Migrando dados locais para Firebase...');
                const parsedData = JSON.parse(localData);
                await saveToFirebase(parsedData);
                console.log('✅ Migração concluída');
            } else {
                // Perguntar qual dados usar
                const useFirebase = confirm(
                    '🔄 Encontramos dados no Firebase.\n\n' +
                    'Deseja usar os dados da nuvem? (OK)\n' +
                    'Ou manter os dados locais? (Cancelar)'
                );
                
                if (useFirebase) {
                    localStorage.setItem('tradingProData', JSON.stringify(firebaseData));
                    window.location.reload();
                } else {
                    await saveToFirebase(JSON.parse(localData));
                }
            }
        } catch (error) {
            console.error('❌ Erro na migração:', error);
        }
    }
}

// Inicialização
async function initFirebase() {
    try {
        console.log('🚀 Inicializando Firebase...');
        
        // Autenticar usuário
        await initAuth();
        
        // Configurar sincronização em tempo real
        setupRealtimeSync();
        
        // Migrar dados se necessário
        await migrateToFirebase();
        
        // Sincronizar periodicamente (a cada 30 segundos)
        setInterval(syncData, 30000);
        
        // Atualizar status de conexão
        updateConnectionStatus(isOnline);
        
        console.log('✅ Firebase inicializado com sucesso');
    } catch (error) {
        console.error('❌ Erro ao inicializar Firebase:', error);
    }
}

// Exportar funções necessárias
export {
    initFirebase,
    saveToFirebase,
    loadFromFirebase,
    syncData,
    auth,
    db,
    currentUser
};
