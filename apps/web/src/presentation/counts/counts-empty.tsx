import Image from 'next/image';
import Link from 'next/link';
import emptyPasture from '../assets/empty-pasture.webp';
import { UploadIcon } from '../ui/icons';

export function CountsEmpty({ canUpload }: { canUpload: boolean }) {
  return (
    <section className="empty-state counts-empty" aria-labelledby="counts-empty-title">
      <EmptyPastureVisor />
      <h2 id="counts-empty-title">Todavía no hay conteos</h2>
      <p>
        Sube la foto aérea de un potrero. El detector propone dónde hay animales y una persona
        confirma el total.
      </p>
      {canUpload && (
        <Link href="/conteos/nuevo" className="button button--primary button--lg">
          <UploadIcon size={18} />
          Subir la primera foto
        </Link>
      )}
    </section>
  );
}

/**
 * Un potrero vacío visto por el visor: la línea barre la foto una vez y no encuentra animales. Es
 * el lugar del primer conteo. Ilustración generada (scripts/imagery.mjs).
 */
function EmptyPastureVisor() {
  return (
    <div className="counts-empty__visor" aria-hidden="true">
      <Image
        src={emptyPasture}
        alt=""
        fill
        className="counts-empty__photo"
        placeholder="blur"
        sizes="20rem"
      />
      <span className="counts-empty__sweep" />
      <span className="viewfinder-corners counts-empty__corners" />
    </div>
  );
}
