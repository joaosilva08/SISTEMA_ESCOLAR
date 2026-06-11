// =========================================================================
// 1. CAMADA DE PERSISTÊNCIA (STORAGE SERVICE)
// =========================================================================
const StorageService = {
  get(chave) {
    const dados = localStorage.getItem(chave);
    return dados ? JSON.parse(dados) : [];
  },

  salvar(chave, dados) {
    localStorage.setItem(chave, JSON.stringify(dados));
  },

  inserirItem(chave, item) {
    const lista = this.get(chave);
    lista.push(item);
    this.salvar(chave, lista);
  },

  atualizarLista(chave, novaLista) {
    this.salvar(chave, novaLista);
  }
};

// =========================================================================
// 2. CAMADA DE REGRAS DE NEGÓCIO (BUSINESS SERVICE)
// =========================================================================
const BusinessService = {
  criarSala(nomeSala) {
    if (!nomeSala || nomeSala.trim() === "") {
      throw new Error("O nome da sala não pode estar vazio.");
    }

    const salas = StorageService.get("salas");
    const nomeNormalizado = nomeSala.trim().toLowerCase();
    
    const salaDuplicada = salas.some(sala => sala.nome.trim().toLowerCase() === nomeNormalizado);
    if (salaDuplicada) {
      throw new Error("Já existe uma sala cadastrada com este nome.");
    }

    const novaSala = {
      id: "sala_" + Date.now(),
      nome: nomeSala.trim()
    };

    StorageService.inserirItem("salas", novaSala);
    return novaSala;
  },

  criarAluno(nomeAluno, salaId) {
    if (!nomeAluno || nomeAluno.trim() === "") {
      throw new Error("O nome do aluno não pode estar vazio.");
    }
    if (!salaId) {
      throw new Error("Um aluno não pode existir sem uma sala vinculada.");
    }

    const salas = StorageService.get("salas");
    const salaExiste = salas.some(sala => sala.id === salaId);
    if (!salaExiste) {
      throw new Error("A sala informada não existe no sistema.");
    }

    const novoAluno = {
      id: "aluno_" + Date.now(),
      nome: nomeAluno.trim(),
      salaId: salaId
    };

    StorageService.inserirItem("alunos", novoAluno);
    return novoAluno;
  },

  marcarPresenca(alunoId, dataPresenca, estahPresente, justificativa = null) {
    if (!alunoId) throw new Error("ID do aluno é obrigatório.");
    if (!dataPresenca) throw new Error("A data da presença é obrigatória.");

    const hojeFormatado = new Date().toISOString().split('T')[0];
    const ehRetroativo = dataPresenca < hojeFormatado;

    if (ehRetroativo && (!justificativa || justificativa.trim() === "")) {
      throw new Error("Alterações retroativas (após às 23:59 do dia) exigem uma justificativa obrigatória.");
    }

    const listaPresencas = StorageService.get("presencas");
    const indicePresenca = listaPresencas.findIndex(
      p => p.alunoId === alunoId && p.data === dataPresenca
    );

    const novoLogHistorico = {
      presente: estahPresente,
      timestamp: Date.now(),
      justificativa: ehRetroativo ? justificativa.trim() : null
    };

    if (indicePresenca === -1) {
      const novaPresenca = {
        alunoId: alunoId,
        data: dataPresenca,
        historico: [novoLogHistorico]
      };
      listaPresencas.push(novaPresenca);
    } else {
      listaPresencas[indicePresenca].historico.push(novoLogHistorico);
    }

    StorageService.atualizarLista("presencas", listaPresencas);
  },

  gerarRelatorioAluno(alunoId) {
    const todasPresencas = StorageService.get("presencas");
    const presencasDoAluno = todasPresencas.filter(p => p.alunoId === alunoId);

    let totalDias = presencasDoAluno.length;
    let totalPresencas = 0;
    let totalFaltas = 0;
    let ultimoDiaPresente = "Nenhuma presença registrada";

    presencasDoAluno.sort((a, b) => new Date(a.data) - new Date(b.data));

    presencasDoAluno.forEach(registro => {
      const estadoAtual = registro.historico[registro.historico.length - 1];
      if (estadoAtual.presente) {
        totalPresencas++;
        ultimoDiaPresente = registro.data;
      } else {
        totalFaltas++;
      }
    });

    const porcentagemFrequencia = totalDias > 0 ? ((totalPresencas / totalDias) * 100).toFixed(1) : "0.0";

    return {
      porcentagem: `${porcentagemFrequencia}%`,
      faltas: totalFaltas,
      ultimoDia: ultimoDiaPresente
    };
  }
};

// =========================================================================
// 3. CAMADA DE INTERFACE (UI SERVICE)
// =========================================================================
const UIService = {
  inicializar() {
    document.getElementById("inputDataChamada").value = new Date().toISOString().split('T')[0];
    this.atualizarSelectsSalas();
    this.renderizarListaChamada();
  },

  atualizarSelectsSalas() {
    const salas = StorageService.get("salas");
    const selectAluno = document.getElementById("selectSalaAluno");
    const selectChamada = document.getElementById("selectSalaChamada");

    const options = salas.map(s => `<option value="${s.id}">${s.nome}</option>`).join("");
    
    selectAluno.innerHTML = options || '<option value="">Nenhuma sala criada</option>';
    selectChamada.innerHTML = options || '<option value="">Nenhuma sala criada</option>';
  },

  handleCadastrarSala() {
    const input = document.getElementById("inputSala");
    try {
      BusinessService.criarSala(input.value);
      alert("Sala criada com sucesso!");
      input.value = "";
      this.atualizarSelectsSalas();
      this.renderizarListaChamada();
    } catch (erro) {
      alert(erro.message);
    }
  },

  handleCadastrarAluno() {
    const inputNome = document.getElementById("inputAluno");
    const selectSala = document.getElementById("selectSalaAluno");
    try {
      BusinessService.criarAluno(inputNome.value, selectSala.value);
      alert("Aluno matriculado com sucesso!");
      inputNome.value = "";
      this.renderizarListaChamada();
    } catch (erro) {
      alert(erro.message);
    }
  },

  handleSalvarPresenca(alunoId, estahPresente) {
    const data = document.getElementById("inputDataChamada").value;
    const justificativaInput = document.getElementById("inputJustificativa");
    const justificativa = justificativaInput ? justificativaInput.value : "";

    try {
      BusinessService.marcarPresenca(alunoId, data, estahPresente, justificativa);
      alert("Registro atualizado no histórico!");
      if(justificativaInput) justificativaInput.value = "";
      this.renderizarListaChamada();
    } catch (erro) {
      alert(erro.message);
    }
  },

  renderizarListaChamada() {
    const salaId = document.getElementById("selectSalaChamada").value;
    const data = document.getElementById("inputDataChamada").value;
    const tabela = document.getElementById("tabelaChamada");
    
    const hoje = new Date().toISOString().split('T')[0];
    const containerJustificativa = document.getElementById("containerJustificativa");
    if (data < hoje) {
      containerJustificativa.classList.remove("d-none");
    } else {
      containerJustificativa.classList.add("d-none");
    }

    if (!salaId) {
      tabela.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Cadastre uma sala primeiro.</td></tr>';
      return;
    }

    const alunos = StorageService.get("alunos").filter(a => a.salaId === salaId);
    const presencas = StorageService.get("presencas");

    if (alunos.length === 0) {
      tabela.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Nenhum aluno nesta sala.</td></tr>';
      return;
    }

    tabela.innerHTML = alunos.map(aluno => {
      const presencaData = presencas.find(p => p.alunoId === aluno.id && p.data === data);
      
      let badgeStatus = '<span class="badge bg-secondary">Não Lançado</span>';
      if (presencaData) {
        const ultimoHistorico = presencaData.historico[presencaData.historico.length - 1];
        badgeStatus = ultimoHistorico.presente 
          ? '<span class="badge bg-success">Presente</span>' 
          : '<span class="badge bg-danger">Falta</span>';
      }

      const relatorio = BusinessService.gerarRelatorioAluno(aluno.id);

      return `
        <tr>
          <td><strong>${aluno.nome}</strong></td>
          <td>${badgeStatus}</td>
          <td>
            <button onclick="UIService.handleSalvarPresenca('${aluno.id}', true)" class="btn btn-sm btn-outline-success">P</button>
            <button onclick="UIService.handleSalvarPresenca('${aluno.id}', false)" class="btn btn-sm btn-outline-danger">F</button>
          </td>
          <td>
            <small class="d-block text-muted">Freq: <strong>${relatorio.porcentagem}</strong> | Faltas: ${relatorio.faltas}</small>
            <small class="text-muted d-block" style="font-size: 0.75rem;">Último dia P: ${relatorio.ultimoDia}</small>
          </td>
        </tr>
      `;
    }).join("");
  }
};

// Executa automaticamente ao abrir a página
window.onload = () => UIService.inicializar();