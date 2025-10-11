# Power BI Navigation Menu Visual

<div align="center">

![Power BI](https://img.shields.io/badge/Power%20BI-Custom%20Visual-F2C811?style=for-the-badge&logo=powerbi&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.4-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![D3.js](https://img.shields.io/badge/D3.js-7.9.0-F9A03C?style=for-the-badge&logo=d3.js&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

**A sleek, interactive navigation menu visual for Power BI with slide-out filtering capabilities**

[Features](#features) • [Installation](#installation) • [Usage](#usage) • [Configuration](#configuration) • [Development](#development)

</div>

---

## Overview

The **Navigation Menu Visual** is a powerful Power BI custom visual that provides an elegant slide-out menu interface for filtering and navigating your data. With support for both standard and hierarchical data structures, this visual transforms complex filtering operations into an intuitive, user-friendly experience.

## Features

### Core Functionality
- **Navigation Menu Interface** - Clean, space-saving button that opens a slide-out panel
- **Interactive Filtering** - Click-to-filter functionality with multi-selection support
- **Hierarchical Data Support** - Intelligent detection and rendering of parent-child relationships
- **Collapsible Sections** - Expand/collapse filter categories to manage screen space
- **Search Functionality** - Built-in search boxes for quick value filtering
- **Clear Selections** - Individual "Clear" buttons for each filter category

### User Experience
- **Smooth Animations** - Polished slide-in/slide-out transitions
- **Overlay Background** - Semi-transparent overlay for focus and easy closing
- **Responsive Design** - Adapts to various screen sizes and orientations
- **Empty State Handling** - Helpful prompts when no data is available

### Customization Options
- **Menu Position** - Choose between left or right placement
- **Custom Colors** - Configurable background and button colors
- **Adjustable Width** - Set menu panel width to your preference
- **Overlay Opacity** - Control background overlay transparency

### Technical Features
- **Power BI API 5.3.0** - Built on the latest Power BI visuals API
- **TypeScript** - Type-safe, maintainable codebase
- **D3.js Integration** - Leverages powerful data visualization capabilities
- **Performance Optimized** - Efficient rendering with up to 1000 data points per category

## Installation

### Option 1: Import Pre-built Visual

1. Download the latest `.pbiviz` file from the releases section
2. In Power BI Desktop, click on the **"..."** in the Visualizations pane
3. Select **"Import a visual from a file"**
4. Choose the downloaded `.pbiviz` file
5. The Navigation Menu Visual will appear in your Visualizations pane

### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/markusbegerow/powerbi-navigation-menu.git
cd powerbi-navigation-menu/NavigationMenuVisual

# Install dependencies
npm install

# Build the visual
npm run package
```

The packaged `.pbiviz` file will be created in the `dist` folder.

## Usage

### Quick Start

1. **Add the Visual** - Click the Navigation Menu icon in the Visualizations pane
2. **Add Data** - Drag fields into the "Filters" data role
3. **Configure** - Customize appearance in the Format pane
4. **Interact** - Click the hamburger button to open the filter menu

### Adding Filters

#### Standard Filters
Simply drag any categorical field to the "Filters" field well. Each unique field becomes a collapsible filter section with checkboxes for each value.

#### Hierarchical Filters
The visual automatically detects hierarchical relationships when you add multiple levels from the same hierarchy. For example:
- Category → Subcategory → Product
- Country → State → City

The visual will render these as expandable tree structures with parent-child relationships.

### Working with Selections

- **Select/Deselect** - Click any checkbox or label to toggle selection
- **Multi-Select** - Select multiple values across different categories
- **Clear Category** - Use the "Clear" button to reset a specific category
- **Clear All** - Deselect all values by using Clear on each category
- **Search** - Type in the search box to filter visible values

### Opening and Closing the Menu

- **Open** - Click the hamburger button (☰) in the top-left corner
- **Close** - Click the × button, click the overlay, or click the hamburger again

## Configuration

Access these settings through the Format pane when the visual is selected.

### Menu Settings

| Setting | Type | Description | Default |
|---------|------|-------------|---------|
| **Menu Position** | Enumeration | Position of slide-out panel (Left/Right) | Left |
| **Menu Width** | Numeric | Width of the menu panel in pixels | 380px |
| **Background Color** | Color | Background color of the menu panel | #FFFFFF |
| **Button Color** | Color | Color of the hamburger button | #333333 |
| **Overlay Opacity** | Numeric | Transparency of background overlay (0-100%) | 50% |

### Data Settings

- **Maximum Values per Category**: 1000 (automatic data reduction)
- **Supports Highlighting**: Yes
- **Multi-Selection**: Enabled by default

## Visual Structure

```
NavigationMenuVisual/
├── src/
│   ├── visual.ts          # Main visual logic
│   └── settings.ts        # Formatting settings model
├── style/
│   └── visual.less        # Visual styling
├── assets/
│   └── icon.png          # Visual icon
├── capabilities.json      # Visual capabilities definition
├── pbiviz.json           # Visual metadata
├── package.json          # Node dependencies
└── tsconfig.json         # TypeScript configuration
```

## Development

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Power BI Custom Visuals Tools (`pbiviz`)

### Setup Development Environment

```bash
# Install Power BI tools globally
npm install -g powerbi-visuals-tools

# Navigate to the visual directory
cd NavigationMenuVisual

# Install dependencies
npm install

# Start development server
npm start
```

The visual will be available at `https://localhost:8080/assets/status` and automatically reload on file changes.

### Development Commands

```bash
# Start development server with live reload
npm start

# Build production package
npm run package

# Run ESLint
npm run lint

# Run pbiviz commands
npm run pbiviz
```

### Testing in Power BI

1. Start the development server with `npm start`
2. In Power BI Desktop, enable Developer Mode:
   - File → Options and settings → Options
   - PREVIEW FEATURES → Developer visual
3. The developer visual will appear in the Visualizations pane
4. Add it to your report and start testing

### Project Dependencies

#### Runtime Dependencies
- `powerbi-visuals-api` (~5.3.0) - Power BI Visuals API
- `powerbi-visuals-utils-formattingmodel` (6.0.4) - Formatting utilities
- `d3` (7.9.0) - Data visualization library
- `@types/d3` (7.4.3) - TypeScript definitions for D3

#### Development Dependencies
- `typescript` (5.5.4) - TypeScript compiler
- `eslint` (^9.11.1) - Linting
- `@typescript-eslint/eslint-plugin` (^8.8.0) - TypeScript ESLint rules
- `eslint-plugin-powerbi-visuals` (^1.0.0) - Power BI specific linting rules

## Architecture

### Key Components

**Visual Class** (`src/visual.ts`)
- Main visual implementation
- Handles data processing and rendering
- Manages user interactions and selections

**Filter Processing**
- Automatic hierarchy detection based on field relationships
- Unique value extraction and sorting
- Selection state management

**UI Components**
- Burger button with icon animation
- Slide-out panel with smooth transitions
- Collapsible filter sections
- Search boxes for quick filtering
- Hierarchical tree rendering for parent-child data

### Data Flow

```
Power BI Data → processData() → Filter Categories → renderFilters() → DOM
                                                                        ↓
User Interaction → Selection Manager ← toggleSelection() ← Event Handlers
```

## Browser Support

- Microsoft Edge (Chromium)
- Google Chrome
- Mozilla Firefox
- Safari (latest versions)

## Troubleshooting

### Visual Not Loading
- Ensure you're using Power BI Desktop (latest version)
- Check that custom visuals are enabled in your organization settings
- Verify the `.pbiviz` file is not corrupted

### Filters Not Working
- Confirm fields are added to the "Filters" data role
- Check that the data contains valid categorical values
- Ensure relationships between hierarchical fields are properly defined

### Performance Issues
- Limit the number of unique values per category (< 1000 recommended)
- Reduce the number of active filter categories
- Consider using slicers for very large datasets

## Roadmap

- [ ] Multi-language support
- [ ] Custom icons for categories
- [ ] Export/import filter configurations
- [ ] Bookmark integration
- [ ] Advanced search with regex support
- [ ] Keyboard navigation
- [ ] Theme presets (Dark mode, High contrast)

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please ensure your code:
- Follows the existing code style
- Passes ESLint checks (`npm run lint`)
- Includes appropriate comments and documentation

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Power BI Custom Visuals Tools](https://github.com/Microsoft/PowerBI-visuals-tools)
- Styled with inspiration from modern UI/UX principles
- Powered by [D3.js](https://d3js.org/) for data manipulation

## 🙋‍♂️ Get Involved

For issues, questions, or suggestions:
- Open an issue on [GitHub](https://github.com/markusbegerow/powerbi-navigation-menu/issues)
- Check existing issues for solutions
- Provide detailed reproduction steps for bugs

## ☕ Support the Project

If you like this project, support further development with a repost or coffee:

<a href="https://www.linkedin.com/sharing/share-offsite/?url=https://github.com/MarkusBegerow/powerbi-navigation-menu" target="_blank"> <img src="https://img.shields.io/badge/💼-Share%20on%20LinkedIn-blue" /> </a>

[![Buy Me a Coffee](https://img.shields.io/badge/☕-Buy%20me%20a%20coffee-yellow)](https://paypal.me/MarkusBegerow?country.x=DE&locale.x=de_DE)

## 📬 Contact

- 🧑‍💻 [Markus Begerow](https://linkedin.com/in/markusbegerow)
- 💾 [GitHub](https://github.com/markusbegerow)
- ✉️ [Twitter](https://x.com/markusbegerow)

---

<div align="center">

**Made with ❤️ for the Power BI Community**

</div>
