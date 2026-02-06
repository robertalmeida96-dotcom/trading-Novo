# 🔧 Guia de Solução de Problemas

## 🚨 Problemas Comuns e Soluções

---

### ❌ Problema 1: "Firebase not defined"

**Sintoma:**
- Console mostra erro: `Uncaught ReferenceError: firebase is not defined`
- Site não carrega

**Causa:**
- Arquivo `firebase-config.js` não está sendo carregado

**Solução:**
```html
<!-- Verificar se está assim no index.html: -->
<script type="module">
    import { initFirebase } from './firebase-config.js';
    // ...
</script>

<!-- Verificar se os arquivos estão na mesma pasta:
   public/
   ├── index.html
   └── firebase-config.js
-->
```

---

### ❌ Problema 2: "Missing or insufficient permissions"

**Sintoma:**
- Dados não salvam
- Console mostra: `FirebaseError: Missing or insufficient permissions`

**Causa:**
- Regras de segurança do Firestore não estão corretas

**Solução:**

1. Acesse: https://console.firebase.google.com/
2. Selecione seu projeto
3. Menu lateral > Firestore Database
4. Aba "Regras"
5. Cole este código:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

6. Clique em "Publicar"
7. Aguarde 1 minuto
8. Teste novamente

---

### ❌ Problema 3: Site não carrega após deploy

**Sintoma:**
- `firebase deploy` funciona
- Mas ao abrir a URL, aparece erro 404

**Causa:**
- Arquivos na pasta errada

**Solução:**

```bash
# Verificar estrutura:
trading-pro-firebase/
├── public/          ← ARQUIVOS DEVEM ESTAR AQUI
│   ├── index.html
│   └── firebase-config.js
├── firebase.json
└── ...

# Se estiver errado, corrigir:
mkdir -p public
mv index.html public/
mv firebase-config.js public/

# Fazer deploy novamente:
firebase deploy
```

---

### ❌ Problema 4: Indicador sempre "Offline"

**Sintoma:**
- Indicador vermelho permanente
- Dados não sincronizam

**Causa:**
- Firebase não inicializado corretamente
- Credenciais inválidas

**Solução:**

1. Abrir Console do navegador (F12)
2. Ver mensagens de erro em vermelho
3. Se aparecer "Firebase: Error (auth/invalid-api-key)":

```javascript
// Verificar firebase-config.js:
const firebaseConfig = {
    apiKey: "AIza...",  // ← Verificar se é sua chave real
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto",
    // ...
};

// ❌ ERRADO: apiKey: "SUA_API_KEY_AQUI"
// ✅ CERTO: apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXX"
```

4. Obter credenciais corretas:
   - Firebase Console > ⚙️ > Configurações do projeto
   - Rolar até "Seus aplicativos"
   - Copiar o `firebaseConfig` completo

---

### ❌ Problema 5: Dados não aparecem em outro dispositivo

**Sintoma:**
- No PC: dados salvam normalmente
- No celular: dados não aparecem

**Causa:**
- Diferentes usuários anônimos

**Solução:**

**Opção A - Reset e Migração:**
```javascript
// No dispositivo principal (PC):
// 1. Abrir Console (F12)
// 2. Copiar o UID do usuário:
console.log('Meu UID:', firebase.auth().currentUser.uid);

// No outro dispositivo (celular):
// 1. Abrir Console
// 2. Verificar o UID
// Se for diferente, os dados estão em "contas" diferentes
```

**Opção B - Implementar Login com Email (Avançado):**

Editar `firebase-config.js` para adicionar login real:

```javascript
// Substituir signInAnonymously por:
import { 
    getAuth, 
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword 
} from "firebase/auth";

// Função de login
async function loginWithEmail(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            // Criar conta se não existir
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            return userCredential.user;
        }
        throw error;
    }
}
```

---

### ❌ Problema 6: "Firebase command not found"

**Sintoma:**
```bash
$ firebase deploy
bash: firebase: command not found
```

**Causa:**
- Firebase CLI não instalado ou não no PATH

**Solução:**

**Windows:**
```cmd
# Reinstalar globalmente
npm install -g firebase-tools

# Se continuar o erro, adicionar ao PATH:
# 1. Abrir "Variáveis de Ambiente"
# 2. Adicionar: C:\Users\SEU_USUARIO\AppData\Roaming\npm
```

**Mac/Linux:**
```bash
# Reinstalar
sudo npm install -g firebase-tools

# Ou usar npx:
npx firebase-tools deploy
```

---

### ❌ Problema 7: Deploy muito lento

**Sintoma:**
- `firebase deploy` leva mais de 5 minutos

**Causa:**
- Fazendo deploy de arquivos desnecessários

**Solução:**

1. Verificar `.firebaserc`:
```json
{
  "projects": {
    "default": "seu-projeto"
  }
}
```

2. Verificar `firebase.json`:
```json
{
  "hosting": {
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ]
  }
}
```

3. Fazer deploy apenas do hosting:
```bash
firebase deploy --only hosting
```

---

### ❌ Problema 8: Dados duplicados

**Sintoma:**
- Operações aparecem duplicadas
- Contas duplicadas

**Causa:**
- Código salvando duas vezes

**Solução:**

No `index.html`, verificar se há apenas UMA chamada de `localStorage.setItem()` por ação:

```javascript
// ❌ ERRADO:
function saveData() {
    localStorage.setItem('tradingProData', JSON.stringify(data));
    localStorage.setItem('tradingProData', JSON.stringify(data)); // DUPLICADO!
}

// ✅ CERTO:
function saveData() {
    localStorage.setItem('tradingProData', JSON.stringify(data));
}
```

---

### ❌ Problema 9: Erro CORS

**Sintoma:**
```
Access to fetch at 'https://firestore.googleapis.com/...' 
has been blocked by CORS policy
```

**Causa:**
- Arquivo aberto diretamente (file://)

**Solução:**

**Não abrir o arquivo diretamente!**

```bash
# ❌ ERRADO:
# Dar duplo clique no index.html

# ✅ CERTO:
# Usar servidor local:
firebase serve

# Ou usar Python:
python -m http.server 8000

# Ou fazer deploy:
firebase deploy
```

---

### ❌ Problema 10: "Quota exceeded"

**Sintoma:**
```
FirebaseError: Quota exceeded
```

**Causa:**
- Limites do plano gratuito excedidos

**Solução:**

1. Verificar uso no Firebase Console:
   - Firestore Database > Uso
   - Verificar leituras/escritas

2. Reduzir sincronizações:

No `firebase-config.js`, aumentar intervalo:

```javascript
// De 30 segundos para 5 minutos:
setInterval(syncData, 5 * 60 * 1000);
```

3. Otimizar estrutura de dados (agrupar mais dados em menos documentos)

---

## 🔍 Como Depurar

### Passo 1: Abrir Console do Navegador

**Chrome/Edge:**
- F12 ou Ctrl+Shift+I
- Aba "Console"

**Firefox:**
- F12 ou Ctrl+Shift+K
- Aba "Console"

**Safari:**
- Cmd+Option+C
- Aba "Console"

### Passo 2: Procurar Erros em Vermelho

Mensagens em vermelho indicam erros. Exemplos:

```
❌ FirebaseError: Missing or insufficient permissions
→ Problema nas regras de segurança

❌ ReferenceError: firebase is not defined
→ Firebase não carregado

❌ TypeError: Cannot read property 'uid' of null
→ Usuário não autenticado
```

### Passo 3: Verificar Network

1. Aba "Network" (Rede)
2. Recarregar página (F5)
3. Procurar requisições em vermelho (status 4xx ou 5xx)

### Passo 4: Testar Conectividade Firebase

No Console:

```javascript
// Testar se Firebase está carregado:
console.log('Firebase:', firebase);

// Testar se usuário está autenticado:
console.log('User:', firebase.auth().currentUser);

// Testar conexão com Firestore:
firebase.firestore().collection('test').add({test: true})
    .then(() => console.log('✅ Firestore OK'))
    .catch(err => console.error('❌ Firestore Error:', err));
```

---

## 📞 Obter Suporte

### 1. Stack Overflow
- Tag: `firebase`, `firestore`
- Buscar erros exatos

### 2. Firebase Discord
- https://discord.gg/firebase

### 3. Documentação Oficial
- https://firebase.google.com/docs

### 4. YouTube
- "Firebase tutorial português"
- "Firestore error [seu erro]"

---

## 💡 Dicas de Prevenção

### ✅ Fazer Sempre

1. **Backup Regular:**
```javascript
// No Console do navegador:
const data = localStorage.getItem('tradingProData');
console.log(data); // Copiar e salvar
```

2. **Testar Localmente Primeiro:**
```bash
firebase serve
# Abrir: http://localhost:5000
```

3. **Verificar Console Regularmente:**
- F12 antes de usar
- Ver se há warnings amarelos

4. **Manter Firebase Atualizado:**
```bash
npm update -g firebase-tools
```

### ❌ Nunca Fazer

1. Compartilhar suas credenciais do Firebase
2. Modificar regras sem entender
3. Deletar dados sem backup
4. Fazer deploy sem testar localmente

---

## 🔐 Verificação de Segurança

### Checklist de Segurança:

- [ ] Regras de Firestore configuradas corretamente
- [ ] Authentication anônima ativada
- [ ] Credenciais do Firebase não expostas publicamente
- [ ] .gitignore configurado (se usar Git)
- [ ] Apenas usuário logado acessa seus próprios dados

### Testar Segurança:

1. Abrir Console do Firestore
2. Tentar acessar dados manualmente
3. Verificar se está isolado por UID

---

**💬 Se o problema persistir, copie a mensagem de erro completa e busque no Stack Overflow!**
