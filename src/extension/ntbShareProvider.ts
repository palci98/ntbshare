/**
 * Subject: Bachelor's thesis
 * Author: Pavel Podluzansky | xpodlu01@stud.fit.vutbr.cz
 * Year: 2021
 * Description:
 * 
 *     This is the main file for previewing notebook
 *     on the joiner side. The class ntbShareSerializer,
 *     is responsible for opening and saving notebook documents 
 * 
 */

import * as vscode from 'vscode';
import { TextDecoder, TextEncoder } from "util";


interface StreamOutput {
	output_type: 'stream';
	text: string;
}

interface ErrorOutput{
  output_type: 'error';
	ename: string;
	evalue: string;
	traceback: string[];
}

interface DataDisplay{
  "text/plain"?: [string],
  "image/png"?: any,
  "application/json"?:any,
  "image/jpeg"?: any,
  "application/javascript"?: any,
  "text/html"?: any,
  "image/svg+xml"?:any,
  "text/markdown"?:any
}

interface DisplayOutput {
	output_type: 'display_data';
	data: DataDisplay ;
}

type SaveOutput = StreamOutput| ErrorOutput | DisplayOutput

interface SaveCell {
	cell_type: 'markdown' | 'code',
	source: string[],
	outputs?: SaveOutput[];
}

interface RawNotebookData {
  cells: RawCell[]
}

export interface RawCell {
	cell_type: 'markdown' | 'code',
	source: string[],
	outputs?: RawCellOutput[];
}

export interface RawCellOutput {
  mime: string;
  data: any;
}
/**
 * ntbShareSerilizer implement vscode NotebookSerializer 
 * the class of ntbShareSerializer is responsible for 
 * previewing the notebook document on the joiner device.
 * 
 */
export class ntbShareSerializer implements vscode.NotebookSerializer {
  constructor(){ 
  }

  public async deserializeNotebook(data: Uint8Array, token: vscode.CancellationToken): Promise<vscode.NotebookData> {
    
    /**
     * 
     * This function takes cell of the code and generate output items
     * in a form which can be opened by editor
     * 
     * @param cells cell of notebook
     * @returns items in the form which can be opened by editor
     */
    function generateItems(cells: RawCell)
    {
      let result: vscode.NotebookCellOutputItem[] = [];
      for(let output of cells.outputs!) {
        if (output.data.type === 'Buffer') {
          output.data.data = new Uint8Array(output.data.data);
        }        
        result.push(new vscode.NotebookCellOutputItem(output.data.data , output.mime));
      }
      return result
    }
    
    let contents = '';
    try {
      contents = new TextDecoder().decode(data);
    } catch {
    }
    let raw: RawNotebookData;
    try {
      raw = <RawNotebookData>JSON.parse(contents);
    } catch {
      raw = {cells: []};
    }
    const cells = raw.cells.map(item => new vscode.NotebookCellData(
        item.cell_type ==='code'?  2 : 1,
        item.source ? item.source.join('') : '',
        item.cell_type ==='code'? "python" : "markdown",
        ));
      cells.forEach((value,i)=>
        {
          if(value.kind === vscode.NotebookCellKind.Code)
          {
            if(raw.cells[i].outputs?.length ===0)
            {
              value.outputs = []
            }
            else{
              value.outputs = [new vscode.NotebookCellOutput(generateItems(raw.cells[i]))]
            }
          }})
      return new vscode.NotebookData(cells);
  }

  public async serializeNotebook(data: vscode.NotebookData, token: vscode.CancellationToken): Promise<Uint8Array> {
    /**
     * Save Output in the form in which can be the output view in Jupyter extension
     * @param cell The cell of the notebook
     * @returns cell output items
     */
    function saveOutput(cell: vscode.NotebookCellData): SaveOutput[]{
			let result: SaveOutput[] = [];
      let data: DataDisplay ={}
			for (let output of cell.outputs!) {
				for (let item of output.items) {
            let outputContents:string = '';
            try {
                outputContents = new TextDecoder().decode(item.data);
            } catch {
                
            }
            try {
                let outputData = JSON.parse(outputContents);
                result.push({ output_type:"error",ename:outputData!.name,evalue:outputData.message,traceback:[outputData.stack]});
              } catch {
                if(item.mime === 'application/vnd.code.notebook.stdout'){
                    result.push({ output_type:"stream",text: outputContents});
                }
                else{
                    if(outputContents.length!==0){
                        if(item.mime === "text/plain")
                        {
                          data!['text/plain']=[outputContents]
                        }
                        else if(item.mime === "image/svg+xml")
                            data!["image/svg+xml"]=outputContents
                        else if(item.mime === "image/png")
                        {
                            data!["image/png"]= outputContents
                        }
                        else if(item.mime === "image/jpeg")
                        {
                            data!["image/jpeg"] = outputContents
                        }
                        else if(item.mime === "text/markdown")
                        {
                            data!["text/markdown"] = outputContents
                        }
                        else if(item.mime === "application/json")
                        {
                            data!["application/json"]= outputContents
                        }
                        else if(item.mime ==="application/javascript")
                        {
                            data!["application/javascript"] = {
                              "json": outputContents
                            }
                        }
                    }
                  }
            }
				}
			}
      if(data!)
      {
        result.push({output_type:"display_data",data})
        return result
      }
			return result;
		}
  
    let contents: SaveCell[] = [];
    for (let cell of data.cells) {
			contents.push({
				cell_type: cell.kind ===2 ?  'code' : 'markdown',
				source: [cell.value],
				outputs: saveOutput(cell)
			});
		}
    let cells: {cells:SaveCell[]} = {cells:contents}
		return new TextEncoder().encode(JSON.stringify(cells, undefined, 2));
	}
}