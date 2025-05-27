const firebaseConfig = {
  apiKey: "AIzaSyBnl2p5jBap04iXUdyL2Uko9dxGUy5Tpko",
  authDomain: "agendamento-ae896.firebaseapp.com",
  projectId: "agendamento-ae896",
  storageBucket: "agendamento-ae896.appspot.com",
  messagingSenderId: "755996309787",
  appId: "1:755996309787:web:3b4be84dd07512c829fbbe",
  measurementId: "G-M0X48MH74Z",
};

// Inicializa o Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Variáveis globais
let selectedDate = null;
let selectedTime = null;
let currentUser = null;
let reservaAtual = null;
let modoAdmin = false;
let calendarioInput, calendarioAdminInput, dataCriacaoInput;
let acaoConfirmacao = null;

// Inicialização
document.addEventListener("DOMContentLoaded", function () {
  // Configura o localStorage para "lembrar" o usuário
  currentUser = localStorage.getItem("agendamento_user") || generateUserId();
  localStorage.setItem("agendamento_user", currentUser);

  // Configuração comum para os calendários
  const commonConfig = {
    locale: "pt",
    minDate: "today",
    dateFormat: "d/m/Y",
    defaultDate: new Date(), // Mostra o dia atual por padrão
    onChange: function (selectedDates, dateStr, instance) {
      selectedDate = formatFirestoreDate(selectedDates[0]);
      resetarPagina();
    },
  };

  // Inicializa os calendários
  calendarioInput = flatpickr("#calendario-input", {
    ...commonConfig,
    onChange: function (selectedDates, dateStr, instance) {
      selectedDate = formatFirestoreDate(selectedDates[0]);
      carregarHorariosDisponiveis();
    },
  });

  calendarioAdminInput = flatpickr("#calendario-admin-input", {
    ...commonConfig,
    onChange: function (selectedDates, dateStr, instance) {
      selectedDate = formatFirestoreDate(selectedDates[0]);
      carregarHorariosAdmin();
    },
  });

  dataCriacaoInput = flatpickr("#data-criacao-input", {
    ...commonConfig,
    onChange: function (selectedDates, dateStr, instance) {
      selectedDate = formatFirestoreDate(selectedDates[0]);
      criarBotoesHorarios();
    },
  });

  // Carrega automaticamente o dia atual
  selectedDate = formatFirestoreDate(new Date());

  // Se estiver na página de horários, carrega automaticamente
  if (window.location.hash === "#horarios") {
    mostrarPagina("horarios");
    carregarHorariosDisponiveis();
  }
});

function mostrarMensagem(titulo, mensagem) {
  document.getElementById("mensagem-titulo").textContent = titulo;
  document.getElementById("mensagem-conteudo").textContent = mensagem;
  document.getElementById("mensagem-modal").classList.remove("hidden");
  document.body.insertAdjacentHTML("beforeend", '<div class="overlay"></div>');
}

function mostrarConfirmacao(titulo, mensagem, acao) {
  document.getElementById("confirmacao-titulo").textContent = titulo;
  document.getElementById("confirmacao-mensagem").textContent = mensagem;
  document.getElementById("confirmacao-botao").textContent = titulo;
  acaoConfirmacao = acao;
  document.getElementById("confirmacao-modal").classList.remove("hidden");
  document.body.insertAdjacentHTML("beforeend", '<div class="overlay"></div>');
}

function confirmarAcao() {
  if (acaoConfirmacao) {
    acaoConfirmacao();
  }
  fecharModal();
}

function mostrarMensagemFlutuante(mensagem) {
  const div = document.createElement("div");
  div.className = "mensagem-flutuante";
  div.textContent = mensagem;
  document.body.appendChild(div);

  setTimeout(() => {
    div.remove();
  }, 3000);
}

function resetarPagina() {
  const paginaAtual = document.querySelector("section:not(.hidden)").id;

  if (paginaAtual === "pagina-horarios") {
    carregarHorariosDisponiveis();
  } else if (paginaAtual === "pagina-admin") {
    carregarHorariosAdmin();
  } else if (paginaAtual === "pagina-admin-criar") {
    criarBotoesHorarios();
  }
}

// Funções de navegação
function mostrarPagina(pagina) {
  document.getElementById("pagina-inicial").classList.add("hidden");
  document.getElementById("pagina-horarios").classList.add("hidden");
  document.getElementById("pagina-minhas-reservas").classList.add("hidden");
  document.getElementById("pagina-admin").classList.add("hidden");
  document.getElementById("pagina-admin-criar").classList.add("hidden");

  // Reseta os calendários para a data atual
  const hoje = new Date();
  selectedDate = formatFirestoreDate(hoje);

  if (pagina === "inicial") {
    document.getElementById("pagina-inicial").classList.remove("hidden");
  } else if (pagina === "horarios") {
    calendarioInput.setDate(hoje);
    document.getElementById("pagina-horarios").classList.remove("hidden");
    carregarHorariosDisponiveis();
  } else if (pagina === "minhas-reservas") {
    document
      .getElementById("pagina-minhas-reservas")
      .classList.remove("hidden");
    carregarMinhasReservas();
  } else if (pagina === "admin") {
    modoAdmin = true;
    calendarioAdminInput.setDate(hoje);
    document.getElementById("pagina-admin").classList.remove("hidden");
    carregarHorariosAdmin();
  } else if (pagina === "admin-criar") {
    dataCriacaoInput.setDate(hoje);
    document.getElementById("pagina-admin-criar").classList.remove("hidden");
    criarBotoesHorarios();
  }
}

function mostrarLoginAdmin() {
  document.getElementById("admin-login").classList.remove("hidden");
  document.body.insertAdjacentHTML("beforeend", '<div class="overlay"></div>');
}

function loginAdmin() {
  const user = document.getElementById("admin-user").value;
  const pass = document.getElementById("admin-pass").value;

  // Credenciais válidas (pode adicionar mais se necessário)
  const credenciaisValidas = [
    { usuario: "admin", senha: "admin" },
    { usuario: "adm", senha: "adm" },
  ];

  const credencialValida = credenciaisValidas.some(
    (cred) => cred.usuario === user && cred.senha === pass
  );

  if (credencialValida) {
    fecharModal();
    mostrarPagina("admin");
  } else {
    mostrarMensagem("Login inválido", "Usuário ou senha incorretos.");
  }
}

function fecharModal() {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.classList.add("hidden");
  });
  document.querySelectorAll(".overlay").forEach((overlay) => {
    overlay.remove();
  });
}

// Funções de gerenciamento de usuário
function generateUserId() {
  return "user_" + Math.random().toString(36).substr(2, 9);
}

// Funções de formatação de data
function formatFirestoreDate(date) {
  const d = new Date(date);
  return d.toISOString().split("T")[0]; // Formato YYYY-MM-DD
}

function formatDisplayDate(dateStr) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

function formatTimeDisplay(timeStr) {
  return timeStr.replace(":00", "h");
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Funções para horários disponíveis
async function carregarHorariosDisponiveis() {
  if (!selectedDate) return;

  const horariosDiv = document.getElementById("horarios");
  horariosDiv.innerHTML = "<p>Carregando...</p>";

  try {
    const snapshot = await db.collection("horarios").doc(selectedDate).get();

    if (!snapshot.exists) {
      horariosDiv.innerHTML =
        "<p>Nenhum horário disponível para esta data.</p>";
      return;
    }

    const horariosData = snapshot.data();
    horariosDiv.innerHTML = "";

    // Ordem personalizada dos horários (agora agrupados corretamente)
    const horariosManha = ["08:00", "09:00", "10:00", "11:00"];
    const horariosTarde = [
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
    ];
    const horariosOrdenados = [...horariosManha, ...horariosTarde];

    horariosOrdenados.forEach((time) => {
      if (horariosData[time] !== undefined) {
        const btn = document.createElement("button");
        btn.className = "horario-btn";

        if (horariosData[time].reservado) {
          btn.textContent = `${formatTimeDisplay(time)} (Reservado)`;
          btn.classList.add("horario-reservado");
          btn.onclick = () =>
            mostrarMensagem(
              "Horário Reservado",
              "Este horário já está reservado."
            );
        } else {
          btn.textContent = formatTimeDisplay(time);
          btn.classList.add("horario-disponivel");
          btn.onclick = () => abrirModalReserva(time);
        }

        horariosDiv.appendChild(btn);
      }
    });
  } catch (error) {
    console.error("Erro ao carregar horários:", error);
    horariosDiv.innerHTML = "<p>Erro ao carregar horários.</p>";
  }
}

function abrirModalReserva(time) {
  selectedTime = time;
  document.getElementById("reserva-modal").classList.remove("hidden");
  document.body.insertAdjacentHTML("beforeend", '<div class="overlay"></div>');
}

async function confirmarReserva() {
  const nome = document.getElementById("cliente-nome").value;
  const telefone = document.getElementById("cliente-telefone").value;
  const pagamento = document.getElementById("forma-pagamento").value;

  if (!nome || !telefone || !pagamento) {
    mostrarMensagem(
      "Campos obrigatórios",
      "Por favor, preencha todos os campos."
    );
    return;
  }

  try {
    // Primeiro verifica se o horário ainda está disponível
    const docRef = await db.collection("horarios").doc(selectedDate).get();
    if (!docRef.exists || docRef.data()[selectedTime].reservado) {
      mostrarMensagem(
        "Horário ocupado",
        "Este horário já foi reservado por outra pessoa."
      );
      carregarHorariosDisponiveis();
      fecharModal();
      return;
    }

    // Atualiza o horário como reservado
    await db
      .collection("horarios")
      .doc(selectedDate)
      .update({
        [selectedTime]: {
          reservado: true,
          clienteId: currentUser,
          nome: nome,
          telefone: telefone,
          pagamento: pagamento,
          dataReserva: new Date().toISOString(),
        },
      });

    // Envia mensagem para o WhatsApp
    const mensagemWhatsApp = `Nova reserva:\n\nData: ${formatDisplayDate(
      selectedDate
    )}\nHorário: ${formatTimeDisplay(
      selectedTime
    )}\nCliente: ${nome}\nTelefone: ${telefone}\nPagamento: ${pagamento}`;
    const urlWhatsApp = `https://wa.me/5527997563197?text=${encodeURIComponent(
      mensagemWhatsApp
    )}`;

    // Abre o WhatsApp em uma nova aba
    window.open(urlWhatsApp, "_blank");

    fecharModal();
    mostrarMensagemFlutuante("Reserva confirmada com sucesso!");
    carregarHorariosDisponiveis();
  } catch (error) {
    console.error("Erro ao confirmar reserva:", error);
    mostrarMensagem("Erro", "Erro ao confirmar reserva. Tente novamente.");
  }
}

// Funções para minhas reservas
async function carregarMinhasReservas() {
  const listaReservas = document.getElementById("lista-reservas");
  listaReservas.innerHTML = "<p>Carregando suas reservas...</p>";

  try {
    // Primeiro obtemos todas as datas que têm horários
    const snapshotDatas = await db.collection("horarios").get();

    if (snapshotDatas.empty) {
      listaReservas.innerHTML = "<p>Você não tem reservas.</p>";
      return;
    }

    let reservasEncontradas = false;
    listaReservas.innerHTML = "";

    // Para cada documento (data) no Firestore
    for (const doc of snapshotDatas.docs) {
      const data = doc.data();

      // Verifica cada horário nesta data
      for (const time in data) {
        if (data[time].reservado && data[time].clienteId === currentUser) {
          reservasEncontradas = true;
          const reservaDiv = document.createElement("div");
          reservaDiv.className = "reserva-item";
          reservaDiv.innerHTML = `
                <p><strong>Data:</strong> ${formatDisplayDate(doc.id)}</p>
                <p><strong>Horário:</strong> ${formatTimeDisplay(time)}</p>
                <p><strong>Pagamento:</strong> ${data[time].pagamento}</p>
              `;
          reservaDiv.onclick = () => {
            mostrarConfirmacao(
              "Cancelar Reserva",
              `Deseja cancelar a reserva para ${formatDisplayDate(
                doc.id
              )} às ${formatTimeDisplay(time)}?`,
              () => cancelarReserva(doc.id, time)
            );
          };
          listaReservas.appendChild(reservaDiv);
        }
      }
    }

    if (!reservasEncontradas) {
      listaReservas.innerHTML = "<p>Você não tem reservas.</p>";
    }
  } catch (error) {
    console.error("Erro ao carregar reservas:", error);
    listaReservas.innerHTML = "<p>Erro ao carregar suas reservas.</p>";
  }
}

async function cancelarReserva(date, time) {
  try {
    // Primeiro verifica se a reserva ainda existe e pertence ao usuário
    const docRef = await db.collection("horarios").doc(date).get();
    if (
      !docRef.exists ||
      !docRef.data()[time] ||
      !docRef.data()[time].reservado ||
      docRef.data()[time].clienteId !== currentUser
    ) {
      mostrarMensagem(
        "Reserva não encontrada",
        "Esta reserva não existe ou já foi cancelada."
      );
      carregarMinhasReservas();
      return;
    }

    // Cancela a reserva
    await db
      .collection("horarios")
      .doc(date)
      .update({
        [time]: {
          reservado: false,
          clienteId: null,
          nome: null,
          telefone: null,
          pagamento: null,
        },
      });

    mostrarMensagemFlutuante("Reserva cancelada com sucesso!");
    carregarMinhasReservas();
  } catch (error) {
    console.error("Erro ao cancelar reserva:", error);
    mostrarMensagem("Erro", "Erro ao cancelar reserva. Tente novamente.");
  }
}

// Funções para admin
async function carregarHorariosAdmin() {
  if (!selectedDate) return;

  const horariosDiv = document.getElementById("horarios-admin");
  horariosDiv.innerHTML = "<p>Carregando...</p>";

  try {
    const snapshot = await db.collection("horarios").doc(selectedDate).get();

    if (!snapshot.exists) {
      horariosDiv.innerHTML =
        "<p>Nenhum horário cadastrado para esta data.</p>";
      return;
    }

    const horariosData = snapshot.data();
    horariosDiv.innerHTML = "";

    // Ordem personalizada dos horários (agora agrupados corretamente)
    const horariosManha = ["08:00", "09:00", "10:00", "11:00"];
    const horariosTarde = [
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
    ];
    const horariosOrdenados = [...horariosManha, ...horariosTarde];

    horariosOrdenados.forEach((time) => {
      if (horariosData[time] !== undefined) {
        const btn = document.createElement("button");
        btn.className = "horario-btn";

        if (horariosData[time].reservado) {
          btn.textContent = `${formatTimeDisplay(time)} (Reservado)`;
          btn.classList.add("horario-reservado");
          btn.onclick = () => mostrarInfoReservaAdmin(horariosData[time], time);
        } else {
          btn.textContent = `${formatTimeDisplay(time)} (Disponível)`;
          btn.classList.add("horario-disponivel");
          btn.onclick = () => {
            selectedTime = time;
            mostrarConfirmacao(
              "Remover Horário",
              `Deseja remover completamente o horário ${formatTimeDisplay(
                time
              )}? Esta ação não poderá ser desfeita.`,
              () => removerHorarioAdmin()
            );
          };
        }

        horariosDiv.appendChild(btn);
      }
    });
  } catch (error) {
    console.error("Erro ao carregar horários:", error);
    horariosDiv.innerHTML = "<p>Erro ao carregar horários.</p>";
  }
}

function mostrarInfoReservaAdmin(reserva, time) {
  document.getElementById("info-data").textContent =
    formatDisplayDate(selectedDate);
  document.getElementById("info-horario").textContent = formatTimeDisplay(time);
  document.getElementById("info-nome").textContent = reserva.nome;
  document.getElementById("info-telefone").textContent = reserva.telefone;
  document.getElementById("info-pagamento").textContent = reserva.pagamento;
  reservaAtual = reserva;
  selectedTime = time;
  document.getElementById("info-reserva-modal").classList.remove("hidden");
  document.body.insertAdjacentHTML("beforeend", '<div class="overlay"></div>');
}

async function cancelarReservaAdmin() {
  try {
    await db
      .collection("horarios")
      .doc(selectedDate)
      .update({
        [selectedTime]: {
          reservado: false,
          clienteId: null,
          nome: null,
          telefone: null,
          pagamento: null,
        },
      });

    if (
      document.getElementById("info-reserva-modal").classList.contains("hidden")
    ) {
      mostrarMensagemFlutuante("Horário liberado com sucesso!");
    } else {
      fecharModal();
    }
    carregarHorariosAdmin();
  } catch (error) {
    console.error("Erro ao cancelar reserva:", error);
    mostrarMensagem("Erro", "Erro ao liberar horário. Tente novamente.");
  }
}

async function removerHorarioAdmin() {
  try {
    await db
      .collection("horarios")
      .doc(selectedDate)
      .update({
        [selectedTime]: firebase.firestore.FieldValue.delete(),
      });

    mostrarMensagemFlutuante("Horário removido com sucesso!");
    carregarHorariosAdmin();
  } catch (error) {
    console.error("Erro ao remover horário:", error);
    mostrarMensagem("Erro", "Erro ao remover horário. Tente novamente.");
  }
}

// Funções para criar horários
function criarBotoesHorarios() {
  if (!selectedDate) return;

  const botoesDiv = document.getElementById("botoes-horarios");
  botoesDiv.innerHTML = "";

  // Horários na ordem específica (agrupados corretamente)
  const horariosManha = ["08:00", "09:00", "10:00", "11:00"];
  const horariosTarde = ["13:00", "14:00", "15:00", "16:00", "17:00", "18:00"];
  const horariosOrdenados = [...horariosManha, ...horariosTarde];

  horariosOrdenados.forEach((time) => {
    const btn = document.createElement("button");
    btn.className = "horario-btn";
    btn.textContent = formatTimeDisplay(time);
    btn.dataset.time = time;
    btn.dataset.selected = "false";
    btn.classList.add("disabled");
    btn.onclick = () => toggleHorarioSelecionado(btn);
    botoesDiv.appendChild(btn);
  });
}

function toggleHorarioSelecionado(btn) {
  btn.classList.toggle("disabled");
  btn.dataset.selected = btn.classList.contains("disabled") ? "false" : "true";

  // Adiciona/remove a classe de horário disponível
  if (btn.classList.contains("disabled")) {
    btn.classList.remove("horario-disponivel");
  } else {
    btn.classList.add("horario-disponivel");
  }
}

function marcarTodosHorarios() {
  document.querySelectorAll("#botoes-horarios .horario-btn").forEach((btn) => {
    btn.classList.remove("disabled");
    btn.classList.add("horario-disponivel");
    btn.dataset.selected = "true";
  });
}

async function preencherSemana() {
  if (!selectedDate) return;

  mostrarConfirmacao(
    "Preencher Semana",
    "Deseja criar horários para os próximos 6 dias a partir da data selecionada?",
    async () => {
      try {
        const dataAtual = new Date(selectedDate);
        const horariosSelecionados = {};

        // Pega os horários selecionados na data atual
        document
          .querySelectorAll(
            '#botoes-horarios .horario-btn[data-selected="true"]'
          )
          .forEach((btn) => {
            horariosSelecionados[btn.dataset.time] = {
              reservado: false,
              clienteId: null,
              nome: null,
              telefone: null,
              pagamento: null,
            };
          });

        if (Object.keys(horariosSelecionados).length === 0) {
          mostrarMensagem(
            "Aviso",
            "Nenhum horário selecionado para a data atual."
          );
          return;
        }

        // Preenche os próximos 6 dias
        for (let i = 1; i <= 6; i++) {
          const novaData = addDays(dataAtual, i);
          const dataStr = formatFirestoreDate(novaData);

          await db
            .collection("horarios")
            .doc(dataStr)
            .set(horariosSelecionados, { merge: true });
        }

        mostrarMensagemFlutuante("Semana preenchida com sucesso!");
      } catch (error) {
        console.error("Erro ao preencher semana:", error);
        mostrarMensagem("Erro", "Erro ao preencher semana. Tente novamente.");
      }
    }
  );
}

async function limparDia() {
  if (!selectedDate) return;

  mostrarConfirmacao(
    "Limpar Horários",
    "Deseja remover TODOS os horários para esta data?",
    async () => {
      try {
        await db.collection("horarios").doc(selectedDate).delete();
        mostrarMensagemFlutuante("Horários removidos com sucesso!");
        criarBotoesHorarios();
      } catch (error) {
        console.error("Erro ao limpar horários:", error);
        mostrarMensagem("Erro", "Erro ao limpar horários. Tente novamente.");
      }
    }
  );
}

async function salvarHorarios() {
  if (!selectedDate) {
    mostrarMensagem("Aviso", "Selecione uma data primeiro.");
    return;
  }

  const horariosSelecionados = {};
  document
    .querySelectorAll('#botoes-horarios .horario-btn[data-selected="true"]')
    .forEach((btn) => {
      horariosSelecionados[btn.dataset.time] = {
        reservado: false,
        clienteId: null,
        nome: null,
        telefone: null,
        pagamento: null,
      };
    });

  if (Object.keys(horariosSelecionados).length === 0) {
    mostrarMensagem("Aviso", "Selecione pelo menos um horário.");
    return;
  }

  try {
    await db
      .collection("horarios")
      .doc(selectedDate)
      .set(horariosSelecionados, { merge: true });
    mostrarMensagemFlutuante("Horários salvos com sucesso!");
    // Não redireciona, fica na mesma página
    criarBotoesHorarios();
  } catch (error) {
    console.error("Erro ao salvar horários:", error);
    mostrarMensagem("Erro", "Erro ao salvar horários. Tente novamente.");
  }
}
