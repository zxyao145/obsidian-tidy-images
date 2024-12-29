import {
	Notice,
	Plugin,
} from "obsidian";
import * as path from "path";

// Remember to rename these classes and interfaces!

interface TidyImagesPluginSettings {
	imageNamePrefix: string;
}

const DEFAULT_SETTINGS: TidyImagesPluginSettings = {
	imageNamePrefix: "${fileName}",
};

export default class TidyImagesPlugin extends Plugin {
	settings: TidyImagesPluginSettings;

	async onload() {
		await this.loadSettings();
		console.log("plugin setting", this.settings);

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon(
			"outdent",
			"Tidy Images",
			(evt: MouseEvent) => {
				this.tidyImages()
				// Called when the user clicks the icon.
				// new Notice("This is a notice!");
			}
		);
		// Perform additional things with the ribbon
		ribbonIconEl.addClass("tidy-images-plugin-ribbon-class");

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// const statusBarItemEl = this.addStatusBarItem();
		// statusBarItemEl.setText("tidy images...");

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: "tidy-images-rename-images",
			name: "Tidy Images: Rename images based on the order they appear",
			checkCallback: (checking) => {
				console.log(checking);
				if (!checking) {
					this.tidyImages();
				}
				return true;
			},
		});
	}

	async tidyImages() {
		const file = this.app.workspace.getActiveFile();
		if (!file) {
			return false;
		}

		const vault = this.app.vault;
		const fileContent = await vault.read(file);
		const imageRegex = /!\[.*?\]\((.*?)\)/g;

		// assets/test%20测试/file-20241221234708379.png
		const images = [];
		let match;
		while ((match = imageRegex.exec(fileContent)) !== null) {
			images.push(match[1]);
		}
		console.log("images", images);

		if (images.length === 0) {
			new Notice("No images found in the file.");
			return;
		}

		// post/test 测试.md
		// console.log("file.path", file.path);
		// post
		const fileDir = path.dirname(file.path);
		// test 测试
		const fileName = path.basename(file.path, ".md");

		let newContent = fileContent;
		// E:\ob
		//@ts-ignore
		const vaultBasePath = this.app.vault.adapter.basePath;

		for (let i = 0; i < images.length; i++) {
			// assets/test%20测试/file-20241221234708379.png
			let oldRealImagePath = images[i];
			const oldImagePath = oldRealImagePath.replaceAll("%20", " ");

			// E:\ob\post\assets\test 测试\file-20241221234708379.png
			const oldImageFullPath = path.resolve(
				vaultBasePath,
				fileDir,
				oldImagePath
			);

			// post/assets/test 测试/file-20241221234708379.png
			const oldVaultPath = path.relative(vaultBasePath, oldImageFullPath)
					.replaceAll('\\', "/");
			if (!(await vault.adapter.exists(oldVaultPath))) {
				new Notice(`Image not found: ${oldVaultPath}`);
				continue;
			}
			// E:\ob\post\assets\test 测试\
			const imgDirName = path.dirname(oldImageFullPath);

			// .png
			const ext = path.extname(oldImagePath);
			let prefix = this.settings.imageNamePrefix.replace(
				"${fileName}",
				fileName
			);
			const newImageName = prefix + `-${i + 1}${ext}`;
			const newImagePath = path.join(imgDirName, newImageName);
			const newVaultPath = path
				.relative(vaultBasePath, newImagePath)
				.replaceAll("\\", "/");
				
			// post/assets/test%20测试/test%20测试-1.png
			const newRealImagePath = path
				.relative(path.join(vaultBasePath, fileDir), newImagePath)
				.replaceAll(' ', "%20")
				.replaceAll('\\', "/");

			// Rename the image file
			try {
				await vault.adapter.rename(
					oldVaultPath,
					newVaultPath
				);
				newContent = newContent.replace(oldRealImagePath, newRealImagePath);
			} catch (error) {
				console.error(
					`Failed to rename image: ${oldImagePath} -> ${newImagePath}`,
					error
				);
				new Notice(`Failed to rename image: ${oldImagePath}`);
			}
		}

		// Update the file with the new content
		await vault.modify(file, newContent);
		new Notice("Images tidied finished.");
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
