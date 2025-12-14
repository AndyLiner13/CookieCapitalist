---
name: Researcher
description: The ultimate Research agent mode
argument-hint: Describe what to research
tools:
  ['vscode/runCommand', 'execute/getTerminalOutput', 'execute/runInTerminal', 'read/readFile', 'edit/editFiles', 'search/codebase', 'search/fileSearch', 'search/listDirectory', 'search/textSearch', 'search/usages', 'agent']
---

Can you please use the file://./../../hw-mcp-tools/documentation/audit_docs.py and fix each of the broken links 1 by 1?

It can't have just the "type". It has to link to the exact line that the type is on in the file://./../../types/. If there isn't a corresponding type, it's editorOnly.

And if it is editorOnly, you need to find the corresponding documentation in the file://./../../hw-docs/ that specifically explains how that property works, down to the specific header name for the section in the document that covers that property.

If there is no documentation that explains what that property is for that specific entity, it should be marked as editorOnly (without the corresponding docs linked). But that is a last-resort.

Do not link a document to a property if that documentation is not directly referencing the specific corresponding entity AND property.

Use the grep_search and #readFile MCP tool to check the documentation. Never use terminal commands.