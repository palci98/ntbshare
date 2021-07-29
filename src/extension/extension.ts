/**
 * Subject: Bachelor's thesis
 * Author: Pavel Podluzansky | xpodlu01@stud.fit.vutbr.cz
 * Year: 2021
 * Description:
 * 
 *		Extension.ts file is the activation file of extension.
 *		If user wants to share or join some shared notebook document,
 *		then the activate function from this file will be called first.
 * 		
 * 		This file registers the notebookSerializer and two commands,
 * 		which can be activated by sharing or joining.
 * 
 */

import * as vscode from 'vscode';
import { ntbShareSerializer } from './ntbShareProvider';
import {diff_match_patch} from 'diff-match-patch';
import { Sharer } from './sharer';
import { Joiner } from './joiner'
import { RawCellOutput } from './ntbShareProvider';

export interface itemsI{
    text:string,index:number,kind:vscode.NotebookCellKind,output:RawCellOutput[]
}

export var dmp = new diff_match_patch();

/**
 * function to delete instance of Joiner class
 */
export function destroyClient(){
	joiner = null
}

/**
 * function to delete instance of Sharer class
 */
export function destroySharer(){
	sharer = null
}

export var sharer: Sharer|null = null;
export var joiner: Joiner|null = null;

export function activate(context: vscode.ExtensionContext) {
	
	// Registering NotebookSerializer
	context.subscriptions.push(vscode.workspace.registerNotebookSerializer('notebook', new ntbShareSerializer()));
	// registering command ntb.share 
	context.subscriptions.push(vscode.commands.registerCommand('ntbshare.share', () => {
		
		// Condition to check how many workspaces are opened   
		if (vscode.workspace?.workspaceFolders && vscode.workspace?.workspaceFolders?.length > 1) {
			return vscode.window.showErrorMessage(
				'Not supporting multiple workspaces already please open only one.');
		}
		// Condition to check if notebook document is opened  
		else if(!vscode.window.activeNotebookEditor)
		{
			return vscode.window.showErrorMessage(
				'You have to open notebook file if you want to share a file')
		}
		// Condition to check if user already sharing
		else if(sharer){
			vscode.window.showErrorMessage(
				'You cant share file to two different room, please try again after you stop sharing');
		}
		// Condition to check if user is connected to some room
		else if(joiner){
			vscode.window.showErrorMessage(
				'You are already in some room please leave a room and try to share again')				
		}
		// Try to connect to the room 
		else
		{
			vscode.window.showInputBox({
				placeHolder: "Create new room for your sharing activities",
				prompt: "example roomName: someroom0001",
				value:"someroom0001"
			}).then(async e=>{
				// If user does not enter the room name
				if(e === undefined || e.length === 0){
					vscode.window.showErrorMessage('You must enter some room name')
				}
				// try to start sharing
				else{
					sharer = new Sharer(e,vscode.window.activeNotebookEditor!.document.uri)
				}
			})
		}}));
		
		// Registering command ntbshare.join
		context.subscriptions.push(vscode.commands.registerCommand('ntbshare.join', () => {
			
			/* Check if some folder is open
			 * Joiner must have opened folder to join a file
			 */
			if (!vscode.workspace.workspaceFolders) {
				vscode.window.showErrorMessage('You have to open workspace if you want to join a session')
			}

			// Condition to check if more then one workspace is opened   
			else if (vscode.workspace.workspaceFolders.length > 1) {
				return vscode.window.showErrorMessage('Please open only one workspace. This extension does not support multiworkspace');
			}
			// condition to check if the Client is already connected to some room 
			else if(joiner){
				vscode.window.showErrorMessage(
					'You are already in some room please leave a room and try to join again')				
			}
			// Condition to check if user already sharing
			else if(sharer){
				vscode.window.showErrorMessage(
					'You are already sharing please leave a room and try to join again')				
			}
			else
			{
				vscode.window.showInputBox({
					placeHolder: "Join room",
					prompt: "example roomName: someroom0001",
					value:"someroom0001"
				}).then(e=>{
					// if user does not enter room name
					if(e === undefined || e.length === 0){
						vscode.window.showErrorMessage('You must enter some room name')
					}
					// try to join 
					else{
						joiner = new Joiner(e!)
					}
				})
			}
		}));	
	}
	
	export function deactivate() {
		
	}