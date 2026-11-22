/**
 * IMC Calculator — Interface & Editorial Readout Controller
 * Integra o frontend diretamente à função calcularIMC(peso, altura) de js/script.js
 * sem modificar nenhuma linha do arquivo original.
 */
(function () {
  "use strict";

  // Elementos do Formulário
  const form = document.getElementById("imc-form");
  const inputPeso = document.getElementById("peso");
  const inputAltura = document.getElementById("altura");
  const fieldPeso = document.getElementById("field-peso");
  const fieldAltura = document.getElementById("field-altura");
  const errorPeso = document.getElementById("peso-error");
  const errorAltura = document.getElementById("altura-error");
  const btnLimpar = document.getElementById("btn-limpar");

  // Elementos do Painel de Leitura (Resultado)
  const resultBox = document.getElementById("result-box");
  const readoutStatus = document.getElementById("readout-status");
  const resultImc = document.getElementById("result-imc");
  const resultUnit = document.getElementById("result-unit");
  const resultClassificationText = document.getElementById("result-classification-text");
  const resultMessage = document.getElementById("result-message");
  const spectrumMarker = document.getElementById("spectrum-marker");
  const tableRows = document.querySelectorAll(".reference-table tbody tr");

  // Tema Claro / Escuro
  const themeToggle = document.getElementById("theme-toggle");
  const themeLabel = document.getElementById("theme-label");

  // Controle de animação numérica
  let activeAnimationId = null;
  let previousImcNumeric = null;

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /**
   * Atualiza o rótulo do botão de tema conforme o estado ativo
   */
  function syncThemeLabel(theme) {
    if (!themeLabel) return;
    themeLabel.textContent = theme === "dark" ? "Escuro" : "Claro";
  }

  function initTheme() {
    const root = document.documentElement;
    syncThemeLabel(root.getAttribute("data-theme") || "light");

    if (!themeToggle) return;

    themeToggle.addEventListener("click", function () {
      const current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
      const next = current === "dark" ? "light" : "dark";

      root.setAttribute("data-theme", next);
      syncThemeLabel(next);

      try {
        localStorage.setItem("imc-theme", next);
      } catch (e) {}
    });
  }

  /**
   * Converte string com vírgula ou ponto para Number
   */
  function parseInputNumber(rawValue) {
    if (typeof rawValue !== "string") return NaN;
    const normalized = rawValue.trim().replace(",", ".");
    if (normalized === "") return NaN;
    return Number(normalized);
  }

  function clearFieldError(fieldWrapper, errorElement, inputElement) {
    fieldWrapper.classList.remove("has-error");
    errorElement.textContent = "";
    if (inputElement) {
      inputElement.removeAttribute("aria-invalid");
    }
  }

  function setFieldError(fieldWrapper, errorElement, inputElement, message) {
    fieldWrapper.classList.add("has-error");
    errorElement.textContent = message;
    if (inputElement) {
      inputElement.setAttribute("aria-invalid", "true");
    }
  }

  function clearTableHighlight() {
    tableRows.forEach(function (row) {
      row.classList.remove("is-active");
    });
  }

  /**
   * Mapeia a classificação retornada por calcularIMC(peso, altura)
   * para a identidade visual da faixa e nota interpretativa sóbria
   */
  function getTierDetails(classificationText) {
    const text = classificationText.toLowerCase();

    if (text.includes("abaixo do peso")) {
      return {
        tier: "underweight",
        note: "Índice inferior a 18,5 kg/m². Indica baixa reserva ponderal para a estatura informada. Recomenda-se avaliação nutricional para investigar necessidades calóricas e metabólicas."
      };
    }
    if (text.includes("peso adequado")) {
      return {
        tier: "normal",
        note: "Índice entre 18,5 e 24,9 kg/m². Situa-se dentro do intervalo de referência da OMS associado ao equilíbrio entre massa corporal e estatura em adultos."
      };
    }
    if (text.includes("sobrepeso")) {
      return {
        tier: "overweight",
        note: "Índice entre 25,0 e 29,9 kg/m². Situa-se acima da faixa padrão. Como o IMC não separa músculo de tecido adiposo, a interpretação deve considerar o biotipo e a composição corporal."
      };
    }
    if (text.includes("obesidade grau iii")) {
      return {
        tier: "obesity-3",
        note: "Índice igual ou superior a 40,0 kg/m². Classificado como obesidade grau III. Recomenda-se acompanhamento médico e nutricional individualizado."
      };
    }
    if (text.includes("obesidade grau ii")) {
      return {
        tier: "obesity-2",
        note: "Índice entre 35,0 e 39,9 kg/m². Classificado como obesidade grau II. Indica necessidade de avaliação clínica detalhada e acompanhamento multiprofissional."
      };
    }
    if (text.includes("obesidade grau i")) {
      return {
        tier: "obesity-1",
        note: "Índice entre 30,0 e 34,9 kg/m². Classificado como obesidade grau I. Recomenda-se consulta com profissional de saúde para avaliação de composição corporal e marcadores clínicos."
      };
    }

    return {
      tier: "neutral",
      note: "Cálculo concluído."
    };
  }

  /**
   * Calcula a posição percentual na régua de 6 zonas iguais (16.6667% cada):
   * Limites dos 6 segmentos: [14, 18.5, 25, 30, 35, 40, 46]
   */
  function computeRulerPosition(imcValue) {
    const segWidth = 100 / 6;
    const bounds = [14, 18.5, 25, 30, 35, 40, 46];

    if (!Number.isFinite(imcValue)) return 0;
    if (imcValue <= bounds[0]) return 1;
    if (imcValue >= bounds[bounds.length - 1]) return 99;

    for (let i = 0; i < 6; i++) {
      const min = bounds[i];
      const max = bounds[i + 1];
      if (imcValue >= min && imcValue <= max) {
        const ratio = (imcValue - min) / (max - min);
        const pct = i * segWidth + ratio * segWidth;
        return Math.max(1, Math.min(99, pct));
      }
    }

    return 50;
  }

  /**
   * Transição numérica suave para o valor do IMC
   */
  function animateImcNumber(targetValue, startValue) {
    if (activeAnimationId) {
      cancelAnimationFrame(activeAnimationId);
      activeAnimationId = null;
    }

    if (prefersReducedMotion() || !Number.isFinite(targetValue)) {
      resultImc.textContent = targetValue.toFixed(2).replace(".", ",");
      return;
    }

    const fromValue = Number.isFinite(startValue) ? startValue : targetValue * 0.85;
    const duration = 420;
    const startTime = performance.now();

    function frame(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = fromValue + (targetValue - fromValue) * eased;

      resultImc.textContent = current.toFixed(2).replace(".", ",");

      if (progress < 1) {
        activeAnimationId = requestAnimationFrame(frame);
      } else {
        resultImc.textContent = targetValue.toFixed(2).replace(".", ",");
        activeAnimationId = null;
      }
    }

    activeAnimationId = requestAnimationFrame(frame);
  }

  // Limpa erros ao digitar
  inputPeso.addEventListener("input", function () {
    if (fieldPeso.classList.contains("has-error")) {
      clearFieldError(fieldPeso, errorPeso, inputPeso);
    }
  });

  inputAltura.addEventListener("input", function () {
    if (fieldAltura.classList.contains("has-error")) {
      clearFieldError(fieldAltura, errorAltura, inputAltura);
    }
  });

  /**
   * Submissão do Formulário integrada a calcularIMC(peso, altura) de js/script.js
   */
  form.addEventListener("submit", function (event) {
    event.preventDefault();

    clearFieldError(fieldPeso, errorPeso, inputPeso);
    clearFieldError(fieldAltura, errorAltura, inputAltura);

    const peso = parseInputNumber(inputPeso.value);
    const altura = parseInputNumber(inputAltura.value);

    // Validação individual usando a própria função calcularIMC de js/script.js
    const checkPeso = calcularIMC(peso, 1.75);
    const checkAltura = calcularIMC(70, altura);

    let hasValidationError = false;
    let firstInvalidField = null;

    if (checkPeso === "Peso inválido.") {
      setFieldError(fieldPeso, errorPeso, inputPeso, checkPeso + " Informe um valor positivo em kg.");
      hasValidationError = true;
      firstInvalidField = inputPeso;
    }

    if (checkAltura === "Altura inválida.") {
      setFieldError(fieldAltura, errorAltura, inputAltura, checkAltura + " Informe sua estatura em metros (ex: 1,75).");
      hasValidationError = true;
      if (!firstInvalidField) {
        firstInvalidField = inputAltura;
      }
    }

    // Chamada principal à função original de js/script.js
    const resultado = calcularIMC(peso, altura);

    if (resultado === "Peso inválido." || resultado === "Altura inválida." || hasValidationError) {
      if (resultado === "Peso inválido." && !fieldPeso.classList.contains("has-error")) {
        setFieldError(fieldPeso, errorPeso, inputPeso, resultado);
        firstInvalidField = firstInvalidField || inputPeso;
      }
      if (resultado === "Altura inválida." && !fieldAltura.classList.contains("has-error")) {
        setFieldError(fieldAltura, errorAltura, inputAltura, resultado);
        firstInvalidField = firstInvalidField || inputAltura;
      }

      if (firstInvalidField) {
        firstInvalidField.focus();
      }
      return;
    }

    // Interpreta o retorno padrão de js/script.js: "IMC: 22.86 - Peso adequado"
    const match = resultado.match(/^IMC:\s*([\d.]+)\s*-\s*(.+)$/);

    if (match) {
      const numericImc = parseFloat(match[1]);
      const classificacao = match[2].trim();
      const details = getTierDetails(classificacao);
      const needlePct = computeRulerPosition(numericImc);

      resultBox.setAttribute("data-state", "active");
      resultBox.setAttribute("data-tier", details.tier);
      readoutStatus.textContent = "Cálculo concluído";
      resultUnit.hidden = false;
      btnLimpar.hidden = false;

      resultClassificationText.textContent = classificacao;
      resultMessage.textContent = details.note;

      if (spectrumMarker) {
        spectrumMarker.style.left = needlePct.toFixed(2) + "%";
      }

      animateImcNumber(numericImc, previousImcNumeric);
      previousImcNumeric = numericImc;

      clearTableHighlight();
      const activeRow = document.querySelector(
        '.reference-table tbody tr[data-tier="' + details.tier + '"]'
      );
      if (activeRow) {
        activeRow.classList.add("is-active");
      }
    } else {
      resultBox.setAttribute("data-state", "active");
      resultBox.setAttribute("data-tier", "neutral");
      readoutStatus.textContent = "Cálculo concluído";
      resultUnit.hidden = true;
      btnLimpar.hidden = false;
      resultImc.textContent = resultado;
      resultClassificationText.textContent = "";
      resultMessage.textContent = "";
    }
  });

  /**
   * Reinicia o formulário e restaura o painel de leitura para o estado inicial
   */
  btnLimpar.addEventListener("click", function () {
    form.reset();
    clearFieldError(fieldPeso, errorPeso, inputPeso);
    clearFieldError(fieldAltura, errorAltura, inputAltura);
    clearTableHighlight();

    if (activeAnimationId) {
      cancelAnimationFrame(activeAnimationId);
      activeAnimationId = null;
    }

    previousImcNumeric = null;
    btnLimpar.hidden = true;

    resultBox.setAttribute("data-state", "idle");
    resultBox.removeAttribute("data-tier");
    readoutStatus.textContent = "Aguardando medidas";
    resultImc.textContent = "—";
    resultUnit.hidden = true;
    resultClassificationText.textContent = "Informe peso e altura ao lado para calcular seu índice.";
    resultMessage.textContent = "O resultado e a posição correspondente na escala da Organização Mundial da Saúde serão exibidos aqui imediatamente após o cálculo.";

    if (spectrumMarker) {
      spectrumMarker.style.left = "0%";
    }

    inputPeso.focus();
  });

  initTheme();
})();
