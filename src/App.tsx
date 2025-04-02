import { useEffect, useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline, Container, Button } from "@mui/material";
import Grid2 from "@mui/material/Grid2";
import LocalDRPStatus from "./components/LocalDRPStatus";
import ChatWindow from "./components/ChatWindow";
import { DRPObject } from "@ts-drp/object";
import { ChatOpenAI, ChatOpenAICallOptions } from "@langchain/openai";
import {
	answerDRPChatTool,
	askDRPChatTool,
	DRPManager,
	queryAnswerDRPChatTool,
	queryConversationDRPChatTool,
} from "./ai-chat/tools";
import { Runnable } from "@langchain/core/runnables";
import { BaseLanguageModelInput } from "@langchain/core/language_models/base";
import { AIMessageChunk } from "@langchain/core/messages";
import { deploy } from "@scrypt-inc/scrypt-ts-btc";
import { main, unlock, withdraw } from "./contracts/deploy";

const theme = createTheme({
	palette: {
		mode: "light",
	},
});

function App() {
	const [drpManager, setDrpManager] = useState<DRPManager | null>(null);
	const [chatObject, setChatObject] = useState<DRPObject | null>(null);
	const [llm, setLlm] = useState<Runnable<
		BaseLanguageModelInput,
		AIMessageChunk,
		ChatOpenAICallOptions
	> | null>(null);

	useEffect(() => {
		let mounted = true;

		const drpManager = new DRPManager(
			import.meta.env.VITE_KEY_SEED || undefined,
		);
		drpManager.start().then(() => {
			if (mounted) {
				setDrpManager(drpManager);
			}
		});

		return () => {
			mounted = false;
		};
	}, []);

	useEffect(() => {
		if (!drpManager) return;

		const tools = [
			askDRPChatTool(drpManager),
			answerDRPChatTool(drpManager),
			queryAnswerDRPChatTool(drpManager),
			queryConversationDRPChatTool(drpManager),
		];
		const llm = new ChatOpenAI({
			model: import.meta.env.VITE_OPENAI_MODEL,
			temperature: 0,
			apiKey: import.meta.env.VITE_OPENAI_API_KEY,
		}).bindTools(tools);
		setLlm(llm);
	}, [drpManager]);

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<Container maxWidth="xl" sx={{ height: "100vh", py: 2 }}>
				<Button
					variant="contained"
					color="primary"
					onClick={async () => {
						try {
							const result = await window.unisat.requestAccounts();
							console.log(result);
						} catch (error) {
							console.error(error);
						}
					}}
				>
					Connect
				</Button>
				<Button
					variant="contained"
					color="primary"
					onClick={async () => {
						await main(30);
						console.log("deployed");
					}}
				>
					Deploy
				</Button>
				<Button
					variant="contained"
					color="primary"
					onClick={async () => {
						await withdraw();
					}}
				>
					Withdraw
				</Button>
				<Button
					variant="contained"
					color="primary"
					onClick={async () => {
						await unlock(
							"f00cfd8df5f92d5e94d1ecbd9b427afd14e03f8a3292ca4128cd59ef7b9643bc",
						);
					}}
				>
					Unlock
				</Button>
				<Grid2 container spacing={2} sx={{ height: "100%" }}>
					<Grid2 size={{ md: 3 }}>
						{drpManager && drpManager.started && (
							<LocalDRPStatus
								drpManager={drpManager}
								onChatObjectCreated={setChatObject}
							/>
						)}
					</Grid2>
					<Grid2 size={{ md: 9 }} sx={{ height: "100%" }}>
						{chatObject && drpManager?.started && llm && (
							<ChatWindow drpManager={drpManager} llm={llm} />
						)}
					</Grid2>
				</Grid2>
			</Container>
		</ThemeProvider>
	);
}

export default App;
