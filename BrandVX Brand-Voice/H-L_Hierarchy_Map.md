\# H-L Hierarchy Mapping Guide

\*\*Purpose:\*\*    
Defines the relationship between the \*\*H-layer\*\* (technical core) and \*\*L-layer\*\* (brand voice) in BrandVX’s repository, and provides instructions for replacing the L-layer with client-specific brand layers.

\---

\#\# Layer Definitions

\#\#\# H-Layer (Technical Core)  
\- File: \`/curriculum\_core\_runtime/BRANDVX\_TEMPORAL\_RUNTIME\_BOOT.md\`  
\- Role: Provides the \*universal operational framework\*, runtime logic, and execution protocols.  
\- Immutable across clients (core BrandVX intellectual property).  
\- Optimized for precision, reproducibility, and scalability.

\#\#\# L-Layer (Brand Voice)  
\- File: \`/app\_brandvx/BRANDVX\_RUNTIME\_BOOT\_BRAND\_VOICE.md\`  
\- Role: Overlays the technical foundation with BrandVX's \*brand-specific tone, UX principles, and product vision\*.  
\- Customizable per client when deploying white-label or derivative models.

\---

\#\# Replacement Logic for Client Deployments

1\. \*\*Retain the H-Layer\*\* exactly as is.  
2\. Swap \`/app\_brandvx/BRANDVX\_RUNTIME\_BOOT\_BRAND\_VOICE.md\` with a \*\*client-specific L-layer\*\*:  
   \- Rename to \`CLIENT\_RUNTIME\_BOOT\_BRAND\_VOICE.md\`.  
   \- Maintain \*\*identical structure\*\* to the BrandVX L-layer for maximum compatibility.  
3\. Ensure new L-layer aligns with:  
   \- The client’s mission, style guide, and UX requirements.  
   \- The technical directives already set by the H-layer.

\---

\#\# Merge Instructions

For workflows that require both:  
1\. Load \*\*H-layer first\*\* for baseline logic.  
2\. Load \*\*L-layer second\*\* to apply brand-specific overrides.  
3\. When conflicts arise:  
   \- Default to \*\*H-layer logic\*\* for technical execution.  
   \- Allow \*\*L-layer\*\* to guide tone, presentation, and contextual framing.

\---

\#\# Future Automation

\- Automate the mapping process so that for each client deployment:  
  \- H-layer is pulled from BrandVX core repo.  
  \- L-layer is dynamically generated or swapped from a client-specific brand pack.  
\- Ensure mapping is \*bi-directional\* for feedback and analytics sharing with BrandVX HQ.

\---

\*\*End of H-L\_Hierarchy\_Map.md\*\*

