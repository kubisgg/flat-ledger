<script setup lang="ts">
import type { PaymentType } from '~/types'

const props = defineProps<{
  type: PaymentType
}>()
const emit = defineEmits<{
  save: [PaymentType]
  remove: [number]
}>()

const editing = ref(false)
const confirmDelete = ref(false)
const draft = reactive({
  id: props.type.id,
  name: props.type.name,
  kind: props.type.kind || (props.type.isMetered ? 'metered' : 'fixed'),
  isRequired: props.type.isRequired,
  defaultActive: props.type.defaultActive || false,
  defaultAmount: props.type.defaultAmount || 0,
  unitPrice: props.type.unitPrice || 0,
  unit: props.type.unit || '',
  notes: props.type.notes || ''
})
const { formatExact } = useMoney()

function unitPriceLabel() {
  const value = new Intl.NumberFormat('pl-PL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(props.type.unitPrice || 0)

  return `${value} zł${props.type.unit ? ` / ${props.type.unit}` : ''}`
}

function startEdit() {
  draft.name = props.type.name
  draft.kind = props.type.kind || (props.type.isMetered ? 'metered' : 'fixed')
  draft.isRequired = props.type.isRequired
  draft.defaultActive = props.type.defaultActive || false
  draft.defaultAmount = props.type.defaultAmount || 0
  draft.unitPrice = props.type.unitPrice || 0
  draft.unit = props.type.unit || ''
  draft.notes = props.type.notes || ''
  editing.value = true
}

function save() {
  emit('save', { ...draft, isMetered: draft.kind === 'metered' })
  editing.value = false
}

function kindLabel() {
  if (props.type.kind === 'metered' || props.type.isMetered) return 'licznikowa'
  if (props.type.kind === 'variable') return 'kwota wpisywana'
  return 'stała'
}
</script>

<template>
  <div class="rounded-lg border border-[#44475a]/50 bg-[#282a36] p-4">
    <div
      v-if="!editing"
      class="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-center"
    >
      <div>
        <p class="font-medium text-stone-100">
          {{ type.name }}
        </p>
        <div class="flex items-center gap-1.5 text-sm text-stone-400">
          <UBadge
            color="neutral"
            variant="subtle"
            size="sm"
          >
            {{ kindLabel() }}
          </UBadge>
          <span>·</span>
          <UBadge
            v-if="type.isRequired"
            color="info"
            variant="subtle"
            size="sm"
          >
            obowiązkowa
          </UBadge>
          <UBadge
            v-else
            :color="type.defaultActive ? 'success' : 'neutral'"
            variant="subtle"
            size="sm"
          >
            {{ type.defaultActive ? 'domyślnie aktywna' : 'domyślnie nieaktywna' }}
          </UBadge>
        </div>
      </div>
      <p class="text-stone-200">
        {{ type.kind === 'metered' || type.isMetered ? unitPriceLabel() : formatExact(type.defaultAmount) }}
      </p>
      <p class="text-sm text-stone-400">
        {{ type.kind === 'metered' || type.isMetered ? (type.unit || 'bez jednostki') : '' }}
      </p>
      <UButton
        icon="i-lucide-pencil"
        color="neutral"
        variant="soft"
        @click="startEdit"
      >
        Edytuj
      </UButton>
    </div>

    <div
      v-else
      class="grid gap-3 md:grid-cols-[2fr_140px_auto_minmax(180px,1.5fr)_auto] md:items-end"
    >
      <UFormField label="Nazwa">
        <UInput
          v-model="draft.name"
          class="w-full"
        />
      </UFormField>
      <UFormField label="Typ">
        <select
          v-model="draft.kind"
          class="w-full rounded-md border border-[#44475a]/60 bg-default px-3 py-2 text-sm text-[#f8f8f2] outline-none focus:border-primary-400"
        >
          <option value="fixed">
            Stała kwota
          </option>
          <option value="metered">
            Licznikowa
          </option>
          <option value="variable">
            Kwota wpisywana
          </option>
        </select>
      </UFormField>
      <div class="flex flex-col gap-1 pb-2">
        <UCheckbox
          v-model="draft.isRequired"
          label="Obowiązkowa"
        />
        <UCheckbox
          v-model="draft.defaultActive"
          label="Domyślnie aktywna"
          :disabled="draft.isRequired"
        />
      </div>
      <div class="flex gap-3">
        <UFormField
          class="flex-1"
          :label="draft.kind === 'metered' ? 'Stawka' : 'Kwota'"
        >
          <UInput
            v-if="draft.kind === 'metered'"
            v-model.number="draft.unitPrice"
            type="number"
            step="0.0001"
            class="w-full"
          />
          <UInput
            v-else
            v-model.number="draft.defaultAmount"
            type="number"
            step="0.01"
            class="w-full"
          />
        </UFormField>
        <UFormField
          v-if="draft.kind === 'metered'"
          label="Jednostka"
          class="w-24"
        >
          <UInput
            v-model="draft.unit"
            class="w-full"
          />
        </UFormField>
      </div>
      <div class="flex flex-col gap-1">
        <div class="flex justify-center gap-1">
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            @click="editing = false"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            @click="confirmDelete = true"
          />
        </div>
        <UButton
          icon="i-lucide-save"
          block
          @click="save"
        >
          Zapisz
        </UButton>
      </div>
    </div>
  </div>

  <UModal
    v-model:open="confirmDelete"
    title="Usuń opłatę"
    description="Tej operacji nie mozna cofnąć."
    :dismissible="false"
    :ui="{ footer: 'justify-end' }"
  >
    <template #footer>
      <UButton
        label="Anuluj"
        color="neutral"
        variant="outline"
        @click="confirmDelete = false"
      />
      <UButton
        label="Usuń"
        color="error"
        @click="emit('remove', type.id); confirmDelete = false"
      />
    </template>
  </UModal>
</template>
