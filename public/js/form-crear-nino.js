// Archivo: /public/js/form-crear-nino.js

document.addEventListener('DOMContentLoaded', () => {
    // Busca el acordeón. Si no lo encuentra, no ejecuta nada más.
    const accordion = document.getElementById('expedienteAccordion');
    if (accordion) {
        setupAccordionNavigation(accordion);
        setupImagePreview();
        setupAgeCalculation();
        setupAlerts();
    }
});

/**
 * Valida los campos requeridos (*).
 * @param {HTMLElement} accordionItem - La sección del acordeón a validar.
 * @returns {boolean} - true si es válido, false si no.
 */
function validateStep(accordionItem) {
    const inputs = accordionItem.querySelectorAll('input[required], select[required], textarea[required]');
    let isValid = true;
    inputs.forEach(input => {
        input.classList.remove('is-invalid');
        if (!input.value || (input.type !== 'checkbox' && !input.value.trim())) {
            isValid = false;
            input.classList.add('is-invalid'); // Muestra un borde rojo si está vacío
        }
    });
    if (!isValid) {
        alert('Por favor, completa todos los campos marcados con (*).');
    }
    return isValid;
}

/**
 * ✅ FUNCIÓN QUE FALTABA: Navega entre las secciones del acordeón.
 * @param {HTMLElement} currentItem - El .accordion-item actual.
 * @param {string} direction - 'next' o 'prev'.
 */
function navigateTo(currentItem, direction) {
    const targetItem = direction === 'next' ? currentItem.nextElementSibling : currentItem.previousElementSibling;
    if (!targetItem) return;

    const currentCollapse = new bootstrap.Collapse(currentItem.querySelector('.accordion-collapse'), { toggle: false });
    const targetCollapse = new bootstrap.Collapse(targetItem.querySelector('.accordion-collapse'), { toggle: false });

    if (direction === 'next') {
        const targetButton = targetItem.querySelector('.accordion-button');
        targetButton.classList.remove('disabled');
        targetButton.removeAttribute('disabled');
        targetButton.setAttribute('data-bs-toggle', 'collapse');
    }

    currentCollapse.hide();
    targetCollapse.show();
    setTimeout(() => targetItem.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
}

/**
 * Configura los event listeners para los botones "Siguiente" y "Anterior".
 */
function setupAccordionNavigation(accordion) {
    accordion.addEventListener('click', async function (e) {
        const target = e.target;
        const currentItem = target.closest('.accordion-item');
        if (!currentItem) return;

        if (target.classList.contains('next-btn')) {
            if (validateStep(currentItem)) {
                // Verificación especial de código duplicado en el primer paso
                if (currentItem.querySelector('#collapseOne')) {
                    const codigoInput = document.getElementById('codigoInput');
                    const codigoValue = codigoInput.value.trim();
                    if (!codigoValue) return;

                    try {
                        const response = await fetch(`/verificar-codigo/${codigoValue}`);
                        const data = await response.json();
                        if (data.exists) {
                            alert(`El código de expediente "${codigoValue}" ya está en uso. Por favor, ingrese uno diferente.`);
                            codigoInput.classList.add('is-invalid');
                        } else {
                            navigateTo(currentItem, 'next');
                        }
                    } catch (error) {
                        console.error('Error al verificar el código:', error);
                        alert('No se pudo verificar el código. Revise su conexión e inténtelo de nuevo.');
                    }
                } else {
                    // Para los demás pasos, simplemente avanza
                    navigateTo(currentItem, 'next');
                }
            }
        }

        if (target.classList.contains('prev-btn')) {
            navigateTo(currentItem, 'prev');
        }
    });
}

/**
 * Configura la vista previa de la imagen de perfil.
 */
function setupImagePreview() {
  const fotoInput = document.getElementById('fotoInput');
  const imagePreviewDiv = document.getElementById('imagePreview'); // Ahora es un div

  if (fotoInput && imagePreviewDiv) {
    fotoInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        const reader = new FileReader();

        reader.onload = function(e) {
          // CAMBIO: Se actualiza el background-image del DIV
          imagePreviewDiv.style.backgroundImage = `url('${e.target.result}')`;
          // Opcional: Oculta el ícono de usuario que está adentro
          imagePreviewDiv.innerHTML = '';
        }

        reader.readAsDataURL(this.files[0]);
      } else {
        // Si el usuario cancela la selección, vuelve al estado inicial
        imagePreviewDiv.style.backgroundImage = 'none';
        imagePreviewDiv.innerHTML = '<i class="fas fa-user fa-3x text-muted"></i>';
      }
    });
  }
}

/**
 * Configura el cálculo automático de la edad.
 */
function setupAgeCalculation() {
    const fechaNacimientoInput = document.getElementById('fechaNacimiento');
    const edadInput = document.getElementById('edad');
    if (fechaNacimientoInput && edadInput) {
        fechaNacimientoInput.addEventListener('change', function () {
            if (!this.value) { edadInput.value = ''; return; }
            const birthDate = new Date(this.value);
            let years = new Date().getFullYear() - birthDate.getFullYear();
            const m = new Date().getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && new Date().getDate() < birthDate.getDate())) { years--; }
            edadInput.value = years >= 0 ? years : 0;
        });

        // Dispara el cálculo si ya hay una fecha al cargar la página
        if (fechaNacimientoInput.value) {
            fechaNacimientoInput.dispatchEvent(new Event('change'));
        }
    }
}

/**
 * Configura el auto-cierre de las alertas.
 */
function setupAlerts() {
    setTimeout(() => {
        document.querySelectorAll('.alert-dismissible').forEach(alertNode => {
            new bootstrap.Alert(alertNode).close();
        });
    }, 5000);
}