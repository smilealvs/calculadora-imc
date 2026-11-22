function calcularIMC(peso, altura) {
  if (!Number.isFinite(peso) || peso <= 0) {
    return "Peso inválido.";
  }

  if (!Number.isFinite(altura) || altura <= 0) {
    return "Altura inválida.";
  }

  let imc = peso / (altura * altura);
  let classificacao;

  if (imc < 18.5) {
    classificacao = "Abaixo do peso / Magreza";
  } else if (imc < 25) {
    classificacao = "Peso adequado";
  } else if (imc < 30) {
    classificacao = "Sobrepeso";
  } else if (imc < 35) {
    classificacao = "Obesidade grau I";
  } else if (imc < 40) {
    classificacao = "Obesidade grau II";
  } else {
    classificacao = "Obesidade grau III";
  }

  return `IMC: ${imc.toFixed(2)} - ${classificacao}`;
}
