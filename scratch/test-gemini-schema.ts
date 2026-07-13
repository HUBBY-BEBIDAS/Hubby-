import "dotenv/config";
import { interpretarPlanilhaComGemini } from "../src/lib/gemini-parser";

const mockCsv = `RowNumber,Name,Price
6,ABSINTO HABITUE 12X750ML,37.30
7,AGUA DE COCO KEROCOCO 12X1000ML,11.07
8,AGUA DE COCO KEROCOCO 12X330ML,6.36
9,AGUARDENTE LEBLON 6X750ML,70.65
10,AGUARDENTE SOLAR TREVO COMPOSTA COM AGRIAO 12X900ML,43.63
11,ANGOSTURA AROMATIC 12X100ML,116.57
12,ANGOSTURA AROMATIC 12X200ML,193.74
15,ANGOSTURA ORANGE 12X100ML,106.28
18,APERITIVO AMARGO BRASILBERG 6X920ML,57.79
19,APERITIVO AMARGO JAGERMEISTER 6X700ML,117.02
20,APERITIVO AMARO AUSANO RAMAZZOTTI 6X700ML,72.42`;

async function main() {
  console.log("Chamando Gemini com mock CSV...");
  try {
    const results = await interpretarPlanilhaComGemini(mockCsv);
    console.log("Sucesso! Resultados:");
    console.log(JSON.stringify(results, null, 2));
  } catch (err: any) {
    console.error("Erro na chamada:");
    console.error(err.message);
    if (err.validationErrors) {
      console.error("Erros de validação Zod:");
      console.error(JSON.stringify(err.validationErrors, null, 2));
    }
    if (err.cause) {
      console.error("Causa do erro:", err.cause);
    }
  }
}

main().catch(console.error);
