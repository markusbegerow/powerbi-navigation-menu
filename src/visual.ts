/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*/
"use strict";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import ISelectionId = powerbi.visuals.ISelectionId;
import DataView = powerbi.DataView;

import { VisualFormattingSettingsModel } from "./settings";

interface FilterCategory {
    name: string;
    displayName: string;
    values: FilterValue[];
    isHierarchy: boolean;
    hierarchyLevels?: HierarchyLevel[];
    order: number;
    collapsed: boolean;
}

interface HierarchyLevel {
    name: string;
    values: FilterValue[];
    levelIndex: number;
}

interface HierarchyNode {
    value: FilterValue;
    level: number;
    expanded: boolean;
    children: HierarchyNode[];
    parent?: HierarchyNode;
}

interface FilterValue {
    value: string;
    identity: ISelectionId;
    selected: boolean;
    indeterminate?: boolean;
    children?: FilterValue[];
    parentValue?: string;
}

export class Visual implements IVisual {
    private target: HTMLElement;
    private container: HTMLElement;
    private burgerButton: HTMLElement;
    private menuPanel: HTMLElement;
    private overlay: HTMLElement;
    private closeButton: HTMLElement;
    private menuContent: HTMLElement;
    private isMenuOpen: boolean = false;
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;
    private selectionManager: ISelectionManager;
    private host: powerbi.extensibility.visual.IVisualHost;
    private filterCategories: FilterCategory[] = [];
    private expandedNodes: Map<string, Set<string>> = new Map();

    constructor(options: VisualConstructorOptions) {
        console.log('Navigation Menu Visual constructor', options);
        this.formattingSettingsService = new FormattingSettingsService();
        this.target = options.element;
        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();

        // Create main container
        this.container = document.createElement("div");
        this.container.className = "burger-menu-container";

        // Create burger button
        this.burgerButton = document.createElement("div");
        this.burgerButton.className = "burger-button";

        const burgerIcon = document.createElement("div");
        burgerIcon.className = "burger-icon";
        for (let i = 0; i < 3; i++) {
            const span = document.createElement("span");
            burgerIcon.appendChild(span);
        }
        this.burgerButton.appendChild(burgerIcon);
        this.burgerButton.addEventListener("click", () => this.toggleMenu());

        // Create overlay
        this.overlay = document.createElement("div");
        this.overlay.className = "menu-overlay";
        this.overlay.addEventListener("click", () => this.closeMenu());

        // Create menu panel
        this.menuPanel = document.createElement("div");
        this.menuPanel.className = "menu-panel";

        // Create close button
        this.closeButton = document.createElement("div");
        this.closeButton.className = "close-button";
        this.closeButton.textContent = "×";
        this.closeButton.addEventListener("click", () => this.closeMenu());

        // Create menu content container
        this.menuContent = document.createElement("div");
        this.menuContent.className = "menu-content";

        // Assemble menu panel
        this.menuPanel.appendChild(this.closeButton);
        this.menuPanel.appendChild(this.menuContent);

        // Assemble container
        this.container.appendChild(this.burgerButton);
        this.container.appendChild(this.overlay);
        this.container.appendChild(this.menuPanel);

        this.target.appendChild(this.container);
    }

    public update(options: VisualUpdateOptions) {
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
            VisualFormattingSettingsModel,
            options.dataViews?.[0]
        );

        const dataView: DataView = options.dataViews?.[0];

        if (!dataView || !dataView.categorical || !dataView.categorical.categories) {
            this.renderEmptyState();
            return;
        }

        this.processData(dataView);
        this.renderFilters();
    }

    private processData(dataView: DataView) {
        // Save current collapsed states
        const collapsedStates = new Map<string, boolean>();
        this.filterCategories.forEach(cat => {
            collapsedStates.set(cat.name, cat.collapsed);
        });

        this.filterCategories = [];

        const categories = dataView.categorical.categories;
        if (!categories) return;

        console.log("=== HIERARCHY DEBUG ===");
        console.log("Total categories:", categories.length);

        // Log all category properties to understand the structure
        categories.forEach((cat, idx) => {
            const catAny = cat as any;
            console.log(`\nCategory ${idx}:`, {
                displayName: cat.source.displayName,
                queryName: cat.source.queryName,
                groupName: (cat.source as any).groupName,
                roles: cat.source.roles,
                type: cat.source.type,
                expr: (cat.source as any).expr,
                identity: catAny.identity,
                identityExprs: catAny.identityExprs
            });
        });

        // Track order and grouping
        const categoryOrder: Array<{type: 'hierarchy' | 'single', name: string, index: number, categories?: typeof categories, category?: any}> = [];
        const processedIndices = new Set<number>();

        // Strategy: Process in order and group categories that share the same queryName prefix
        categories.forEach((cat, idx) => {
            if (processedIndices.has(idx)) return;

            const queryName = cat.source.queryName;
            if (!queryName) {
                categoryOrder.push({type: 'single', name: cat.source.displayName, index: idx, category: cat});
                processedIndices.add(idx);
                return;
            }

            const baseName = queryName.split('.')[0];

            // Find all categories with the same base name
            const relatedCategories: typeof categories = [];
            categories.forEach((otherCat, otherIdx) => {
                const otherQueryName = otherCat.source.queryName;
                if (otherQueryName && otherQueryName.split('.')[0] === baseName) {
                    relatedCategories.push(otherCat);
                    processedIndices.add(otherIdx);
                }
            });

            // If multiple categories share the same base name, it's a hierarchy
            if (relatedCategories.length > 1) {
                const hierarchyName = cat.source.displayName?.split('.')[0] || baseName;
                categoryOrder.push({type: 'hierarchy', name: hierarchyName, index: idx, categories: relatedCategories});
                console.log(`Found hierarchy "${hierarchyName}" with ${relatedCategories.length} levels`);
            } else {
                // Single column
                categoryOrder.push({type: 'single', name: cat.source.displayName, index: idx, category: cat});
                console.log(`Single column: ${cat.source.displayName}`);
            }
        });

        console.log("\nTotal categories:", categoryOrder.length);
        console.log("=== END DEBUG ===\n");

        // Process in order
        categoryOrder.forEach((item, orderIndex) => {
            if (item.type === 'hierarchy') {
                // Build parent-child relationships by analyzing data rows
                const valuesByLevel: Map<string, FilterValue>[] = [];

                // First pass: Create all unique values for each level
                item.categories.forEach((category, levelIdx) => {
                    const uniqueValuesMap = new Map<string, FilterValue>();

                    category.values.forEach((value, index) => {
                        const stringValue = value != null ? String(value) : "(Blank)";

                        if (!uniqueValuesMap.has(stringValue)) {
                            const identity = this.host.createSelectionIdBuilder()
                                .withCategory(category, index)
                                .createSelectionId();

                            uniqueValuesMap.set(stringValue, {
                                value: stringValue,
                                identity: identity,
                                selected: false,
                                children: []
                            });
                        }
                    });

                    valuesByLevel[levelIdx] = uniqueValuesMap;
                });

                // Second pass: Build parent-child relationships based on data rows
                if (item.categories.length > 0) {
                    const rowCount = item.categories[0].values.length;

                    console.log(`Building relationships for ${item.name}, ${rowCount} rows`);

                    for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
                        for (let levelIdx = 0; levelIdx < item.categories.length - 1; levelIdx++) {
                            const parentValue = item.categories[levelIdx].values[rowIdx];
                            const childValue = item.categories[levelIdx + 1].values[rowIdx];

                            const parentStr = parentValue != null ? String(parentValue) : "(Blank)";
                            const childStr = childValue != null ? String(childValue) : "(Blank)";

                            const parent = valuesByLevel[levelIdx].get(parentStr);
                            const child = valuesByLevel[levelIdx + 1].get(childStr);

                            if (parent && child) {
                                // Add child to parent's children if not already present
                                if (!parent.children.some(c => c.value === child.value)) {
                                    parent.children.push(child);
                                    child.parentValue = parent.value;
                                    console.log(`Linked: ${parent.value} → ${child.value}`);
                                }
                            } else {
                                console.warn(`Could not link: ${parentStr} → ${childStr}`, {parent: !!parent, child: !!child});
                            }
                        }
                    }
                }

                // Third pass: Create hierarchy levels AFTER relationships are built, preserving original order
                const hierarchyLevels: HierarchyLevel[] = [];
                item.categories.forEach((category, levelIdx) => {
                    const levelName = category.source.displayName || "Level";
                    // Preserve the order from Power BI (important for time dimensions)
                    const allValues = Array.from(valuesByLevel[levelIdx].values());

                    // Do not sort children - preserve original order from Power BI
                    // This ensures months, days, etc. appear in chronological order
                    // allValues.forEach(val => {
                    //     if (val.children && val.children.length > 0) {
                    //         val.children.sort((a, b) => a.value.localeCompare(b.value));
                    //     }
                    // });

                    hierarchyLevels.push({
                        name: levelName,
                        values: allValues,
                        levelIndex: levelIdx
                    });
                });

                // Log final tree structure
                console.log("Final hierarchy structure:");
                hierarchyLevels.forEach((level, idx) => {
                    console.log(`Level ${idx} (${level.name}):`, level.values.map(v => ({
                        value: v.value,
                        childCount: v.children?.length || 0,
                        children: v.children?.map(c => c.value)
                    })));
                });

                // DIAGNOSTIC: Add debug info
                console.log("=== CHECKING OBST CHILDREN ===");
                const obstLevel = hierarchyLevels.find(l => l.values.some(v => v.value === "Obst"));
                if (obstLevel) {
                    const obst = obstLevel.values.find(v => v.value === "Obst");
                    console.log("DIAGNOSTIC - Obst found at level:", hierarchyLevels.indexOf(obstLevel));
                    console.log("DIAGNOSTIC - Obst children count:", obst?.children?.length || 0);
                    console.log("DIAGNOSTIC - Obst children:", obst?.children?.map(c => ({
                        value: c.value,
                        hasChildren: (c.children?.length || 0) > 0,
                        childCount: c.children?.length || 0
                    })));
                } else {
                    console.warn("DIAGNOSTIC - Obst not found!");
                }
                console.log("=== END OBST CHECK ===");

                this.filterCategories.push({
                    name: item.name,
                    displayName: item.name,
                    values: [],
                    isHierarchy: true,
                    hierarchyLevels: hierarchyLevels,
                    order: orderIndex,
                    collapsed: collapsedStates.get(item.name) ?? false
                });
            } else {
                // Single column
                const category = item.category;
                const categoryName = category.source.displayName || `Filter ${orderIndex + 1}`;
                const values: FilterValue[] = [];

                // Track unique values with their first occurrence index
                const uniqueValuesMap = new Map<string, number>();

                category.values.forEach((value, index) => {
                    const stringValue = value != null ? String(value) : "(Blank)";

                    if (!uniqueValuesMap.has(stringValue)) {
                        uniqueValuesMap.set(stringValue, index);
                    }
                });

                // Create filter values from unique entries
                uniqueValuesMap.forEach((firstIndex, stringValue) => {
                    const identity = this.host.createSelectionIdBuilder()
                        .withCategory(category, firstIndex)
                        .createSelectionId();

                    values.push({
                        value: stringValue,
                        identity: identity,
                        selected: false
                    });
                });

                this.filterCategories.push({
                    name: categoryName,
                    displayName: categoryName,
                    // Preserve original order from Power BI (important for time dimensions)
                    values: values,
                    isHierarchy: false,
                    order: orderIndex,
                    collapsed: collapsedStates.get(categoryName) ?? false
                });
            }
        });
    }

    private renderEmptyState() {
        while (this.menuContent.firstChild) {
            this.menuContent.removeChild(this.menuContent.firstChild);
        }

        const title = document.createElement("h3");
        title.textContent = "Filter Menu";
        this.menuContent.appendChild(title);

        const emptyMessage = document.createElement("div");
        emptyMessage.className = "empty-state";

        const icon = document.createElement("div");
        icon.className = "empty-icon";
        icon.textContent = "⊕";

        const message = document.createElement("p");
        message.textContent = "Add fields to create filters";

        const instruction = document.createElement("p");
        instruction.className = "empty-instruction";
        instruction.textContent = "Drag and drop columns into the 'Filters' field well";

        emptyMessage.appendChild(icon);
        emptyMessage.appendChild(message);
        emptyMessage.appendChild(instruction);
        this.menuContent.appendChild(emptyMessage);
    }

    private renderFilters() {
        // Clear existing content
        while (this.menuContent.firstChild) {
            this.menuContent.removeChild(this.menuContent.firstChild);
        }

        const title = document.createElement("h3");
        title.textContent = "Filters";
        this.menuContent.appendChild(title);

        if (this.filterCategories.length === 0) {
            this.renderEmptyState();
            return;
        }

        // Render each filter category
        this.filterCategories.forEach(category => {
            const categorySection = this.createFilterSection(category);
            this.menuContent.appendChild(categorySection);
        });
    }

    private createFilterSection(category: FilterCategory): HTMLElement {
        if (category.isHierarchy) {
            return this.createHierarchySection(category);
        } else {
            return this.createStandardSection(category);
        }
    }

    private createHierarchySection(category: FilterCategory): HTMLElement {
        const section = document.createElement("div");
        section.className = "filter-section hierarchy-section";

        // Initialize expanded nodes set
        if (!this.expandedNodes.has(category.name)) {
            this.expandedNodes.set(category.name, new Set<string>());
        }

        // Category header
        const header = document.createElement("div");
        header.className = "filter-header collapsible-header";

        // Collapse/expand icon
        const collapseIcon = document.createElement("span");
        collapseIcon.className = "collapse-icon";
        collapseIcon.textContent = category.collapsed ? "▶" : "▼";

        const label = document.createElement("div");
        label.className = "filter-label";
        label.textContent = category.displayName;

        const clearBtn = document.createElement("button");
        clearBtn.className = "clear-button";
        clearBtn.textContent = "Clear";
        clearBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.clearHierarchySelection(category);
        });

        header.appendChild(collapseIcon);
        header.appendChild(label);
        header.appendChild(clearBtn);

        // Toggle collapse on header click
        header.addEventListener("click", () => {
            category.collapsed = !category.collapsed;
            this.renderFilters();
        });

        section.appendChild(header);

        // Return early if collapsed
        if (category.collapsed) {
            return section;
        }

        // Search box for all levels
        const searchBox = document.createElement("input");
        searchBox.type = "text";
        searchBox.className = "filter-search";
        searchBox.placeholder = `Search...`;

        // Hierarchy tree container
        const treeContainer = document.createElement("div");
        treeContainer.className = "filter-values hierarchy-tree";

        const renderTree = (searchTerm: string = "") => {
            while (treeContainer.firstChild) {
                treeContainer.removeChild(treeContainer.firstChild);
            }

            // Auto-expand nodes when searching
            if (searchTerm && category.hierarchyLevels.length > 0) {
                const expandedSet = this.expandedNodes.get(category.name);
                category.hierarchyLevels.forEach((level, idx) => {
                    level.values.forEach(value => {
                        if (this.matchesSearchRecursive(value, searchTerm)) {
                            const nodeKey = `${category.name}_${idx}_${value.value}`;
                            expandedSet.add(nodeKey);
                        }
                    });
                });
            }

            // Render first level - show items that match or have matching descendants
            if (category.hierarchyLevels.length > 0) {
                const firstLevel = category.hierarchyLevels[0];

                firstLevel.values.forEach(value => {
                    if (searchTerm && !this.matchesSearchRecursive(value, searchTerm)) {
                        return;
                    }

                    const nodeItem = this.createHierarchyNode(category, value, 0, searchTerm);
                    treeContainer.appendChild(nodeItem);
                });
            }

            if (treeContainer.children.length === 0) {
                const noResults = document.createElement("div");
                noResults.className = "no-results";
                noResults.textContent = "No results found";
                treeContainer.appendChild(noResults);
            }
        };

        searchBox.addEventListener("input", (e) => {
            renderTree((e.target as HTMLInputElement).value);
        });

        renderTree();

        section.appendChild(searchBox);
        section.appendChild(treeContainer);

        return section;
    }

    private createHierarchyNode(category: FilterCategory, value: FilterValue, level: number, searchTerm: string = ""): HTMLElement {
        const nodeContainer = document.createElement("div");
        nodeContainer.className = "hierarchy-node";

        const nodeKey = `${category.name}_${level}_${value.value}`;
        const isExpanded = this.expandedNodes.get(category.name)?.has(nodeKey) || false;

        // Always support ragged hierarchies: only show expand icon if item actually has children
        const hasChildren = value.children && value.children.length > 0;

        // Node item
        const nodeItem = document.createElement("div");
        nodeItem.className = "hierarchy-node-item";
        nodeItem.style.paddingLeft = `${level * 12 + 8}px`;

        // Expand/collapse icon
        if (hasChildren) {
            const expandIcon = document.createElement("span");
            expandIcon.className = "hierarchy-expand-icon";
            expandIcon.textContent = isExpanded ? "▼" : "▶";
            expandIcon.addEventListener("click", (e) => {
                e.stopPropagation();
                const expanded = this.expandedNodes.get(category.name);
                if (isExpanded) {
                    expanded.delete(nodeKey);
                } else {
                    expanded.add(nodeKey);
                }
                this.renderFilters();
            });
            nodeItem.appendChild(expandIcon);
        } else {
            // Spacer for leaf nodes
            const spacer = document.createElement("span");
            spacer.className = "hierarchy-expand-spacer";
            nodeItem.appendChild(spacer);
        }

        // Checkbox
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = value.selected;
        checkbox.indeterminate = value.indeterminate || false;
        checkbox.className = "filter-checkbox";
        nodeItem.appendChild(checkbox);

        // Label
        const valueLabel = document.createElement("span");
        valueLabel.className = "filter-value-label";
        valueLabel.textContent = value.value;
        valueLabel.title = value.value; // Tooltip for truncated text
        nodeItem.appendChild(valueLabel);

        // Click handler for selection
        nodeItem.addEventListener("click", (e) => {
            e.stopPropagation();
            this.toggleHierarchyValue(value, category, level);
        });

        nodeContainer.appendChild(nodeItem);

        // Render children if expanded - show children that match or have matching descendants
        if (hasChildren && isExpanded && value.children && value.children.length > 0) {
            value.children.forEach(childValue => {
                // Filter by search term - check recursively
                if (searchTerm && !this.matchesSearchRecursive(childValue, searchTerm)) {
                    return;
                }

                const childNode = this.createHierarchyNode(category, childValue, level + 1, searchTerm);
                nodeContainer.appendChild(childNode);
            });
        }

        return nodeContainer;
    }

    private toggleHierarchyValue(filterValue: FilterValue, category: FilterCategory, level: number) {
        const newSelectedState = !filterValue.selected;
        filterValue.selected = newSelectedState;

        // Cascade selection to all descendants
        this.cascadeSelectionToDescendants(filterValue, newSelectedState);

        // Update parent selection based on children
        if (filterValue.parentValue) {
            this.updateParentSelectionRecursive(category, filterValue.parentValue);
        }

        // Collect all selected values from hierarchy
        const selectedIds: ISelectionId[] = [];
        category.hierarchyLevels.forEach(level => {
            level.values.forEach(val => {
                if (val.selected) {
                    selectedIds.push(val.identity);
                }
            });
        });

        // Get selections from other categories
        this.filterCategories.forEach(cat => {
            if (cat.name !== category.name) {
                cat.values.forEach(val => {
                    if (val.selected) {
                        selectedIds.push(val.identity);
                    }
                });
            }
        });

        if (selectedIds.length > 0) {
            this.selectionManager.select(selectedIds, false);
        } else {
            this.selectionManager.clear();
        }

        this.renderFilters();
    }

    private cascadeSelectionToDescendants(filterValue: FilterValue, selected: boolean) {
        // Recursively select/deselect all descendants
        if (filterValue.children && filterValue.children.length > 0) {
            filterValue.children.forEach(child => {
                child.selected = selected;
                child.indeterminate = false;
                this.cascadeSelectionToDescendants(child, selected);
            });
        }
    }

    private updateParentSelectionRecursive(category: FilterCategory, parentValue: string) {
        // Find the parent in all levels
        for (const level of category.hierarchyLevels) {
            const parent = level.values.find(v => v.value === parentValue);
            if (parent && parent.children && parent.children.length > 0) {
                const allChildrenSelected = parent.children.every(c => c.selected);
                const anyChildSelected = parent.children.some(c => c.selected || c.indeterminate);

                if (allChildrenSelected) {
                    parent.selected = true;
                    parent.indeterminate = false;
                } else if (!anyChildSelected) {
                    parent.selected = false;
                    parent.indeterminate = false;
                } else {
                    // Some children are selected or indeterminate
                    parent.selected = false;
                    parent.indeterminate = true;
                }

                // Recursively update grandparent
                if (parent.parentValue) {
                    this.updateParentSelectionRecursive(category, parent.parentValue);
                }
                break;
            }
        }
    }

    private matchesSearchRecursive(value: FilterValue, searchTerm: string): boolean {
        if (!searchTerm) return true;

        const term = searchTerm.toLowerCase();

        // Check if this value matches
        if (value.value.toLowerCase().includes(term)) {
            return true;
        }

        // Check if any children match
        if (value.children && value.children.length > 0) {
            return value.children.some(child => this.matchesSearchRecursive(child, searchTerm));
        }

        return false;
    }

    private createStandardSection(category: FilterCategory): HTMLElement {
        const section = document.createElement("div");
        section.className = "filter-section";

        // Category header
        const header = document.createElement("div");
        header.className = "filter-header collapsible-header";

        // Collapse/expand icon
        const collapseIcon = document.createElement("span");
        collapseIcon.className = "collapse-icon";
        collapseIcon.textContent = category.collapsed ? "▶" : "▼";

        const label = document.createElement("div");
        label.className = "filter-label";
        label.textContent = category.displayName;

        const clearBtn = document.createElement("button");
        clearBtn.className = "clear-button";
        clearBtn.textContent = "Clear";
        clearBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.clearCategorySelection(category);
        });

        header.appendChild(collapseIcon);
        header.appendChild(label);
        header.appendChild(clearBtn);

        // Toggle collapse on header click
        header.addEventListener("click", () => {
            category.collapsed = !category.collapsed;
            this.renderFilters();
        });

        section.appendChild(header);

        // Return early if collapsed
        if (category.collapsed) {
            return section;
        }

        // Search box
        const searchBox = document.createElement("input");
        searchBox.type = "text";
        searchBox.className = "filter-search";
        searchBox.placeholder = `Search ${category.name}...`;

        // Values container
        const valuesContainer = document.createElement("div");
        valuesContainer.className = "filter-values";

        // Render all values
        const renderValues = (searchTerm: string = "") => {
            while (valuesContainer.firstChild) {
                valuesContainer.removeChild(valuesContainer.firstChild);
            }
            const filteredValues = searchTerm
                ? category.values.filter(v => v.value.toLowerCase().includes(searchTerm.toLowerCase()))
                : category.values;

            if (filteredValues.length === 0) {
                const noResults = document.createElement("div");
                noResults.className = "no-results";
                noResults.textContent = "No results found";
                valuesContainer.appendChild(noResults);
                return;
            }

            filteredValues.forEach(filterValue => {
                const valueItem = document.createElement("div");
                valueItem.className = "filter-value-item";
                if (filterValue.selected) {
                    valueItem.classList.add("selected");
                }

                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.checked = filterValue.selected;
                checkbox.className = "filter-checkbox";

                const valueLabel = document.createElement("span");
                valueLabel.className = "filter-value-label";
                valueLabel.textContent = filterValue.value;
                valueLabel.title = filterValue.value; // Tooltip for truncated text

                valueItem.appendChild(checkbox);
                valueItem.appendChild(valueLabel);

                valueItem.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.toggleSelection(filterValue, category);
                });

                valuesContainer.appendChild(valueItem);
            });
        };

        searchBox.addEventListener("input", (e) => {
            renderValues((e.target as HTMLInputElement).value);
        });

        renderValues();

        section.appendChild(searchBox);
        section.appendChild(valuesContainer);

        return section;
    }

    private toggleSelection(filterValue: FilterValue, category: FilterCategory) {
        filterValue.selected = !filterValue.selected;

        // Get all selected identities
        const selectedIds: ISelectionId[] = [];
        this.filterCategories.forEach(cat => {
            cat.values.forEach(val => {
                if (val.selected) {
                    selectedIds.push(val.identity);
                }
            });
        });

        // Apply selection
        if (selectedIds.length > 0) {
            this.selectionManager.select(selectedIds, false);
        } else {
            this.selectionManager.clear();
        }

        // Re-render to update UI
        this.renderFilters();
    }

    private clearCategorySelection(category: FilterCategory) {
        category.values.forEach(val => val.selected = false);

        // Get remaining selected identities
        const selectedIds: ISelectionId[] = [];
        this.filterCategories.forEach(cat => {
            cat.values.forEach(val => {
                if (val.selected) {
                    selectedIds.push(val.identity);
                }
            });
            if (cat.hierarchyLevels) {
                cat.hierarchyLevels.forEach(level => {
                    level.values.forEach(val => {
                        if (val.selected) {
                            selectedIds.push(val.identity);
                        }
                    });
                });
            }
        });

        if (selectedIds.length > 0) {
            this.selectionManager.select(selectedIds, false);
        } else {
            this.selectionManager.clear();
        }

        this.renderFilters();
    }

    private clearHierarchySelection(category: FilterCategory) {
        // Clear all selections in this hierarchy
        category.hierarchyLevels.forEach(level => {
            level.values.forEach(val => val.selected = false);
        });

        // Get remaining selected identities from other categories
        const selectedIds: ISelectionId[] = [];
        this.filterCategories.forEach(cat => {
            if (cat.name !== category.name) {
                cat.values.forEach(val => {
                    if (val.selected) {
                        selectedIds.push(val.identity);
                    }
                });
                if (cat.hierarchyLevels) {
                    cat.hierarchyLevels.forEach(level => {
                        level.values.forEach(val => {
                            if (val.selected) {
                                selectedIds.push(val.identity);
                            }
                        });
                    });
                }
            }
        });

        if (selectedIds.length > 0) {
            this.selectionManager.select(selectedIds, false);
        } else {
            this.selectionManager.clear();
        }

        this.renderFilters();
    }

    private toggleMenu() {
        if (this.isMenuOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    private openMenu() {
        this.isMenuOpen = true;
        this.menuPanel.classList.add("open");
        this.overlay.classList.add("visible");
        this.burgerButton.classList.add("hidden");
    }

    private closeMenu() {
        this.isMenuOpen = false;
        this.menuPanel.classList.remove("open");
        this.overlay.classList.remove("visible");
        this.burgerButton.classList.remove("hidden");
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
