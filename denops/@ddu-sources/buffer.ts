import { Denops, fn } from "https://raw.githubusercontent.com/Shougo/ddu.vim/da6e4ef/denops/ddu/deps.ts";
import { BaseSource, Item } from "https://raw.githubusercontent.com/Shougo/ddu.vim/a8db8a8/denops/ddu/types.ts";

type ActionData = {
  bufnr: number;
  path: string;
  isCurrent: boolean;
  isAlternate: boolean;
  isModified: boolean;
};

type ActionInfo = {
  word: string;
  action: ActionData;
};

type Params = Record<never, never>;

export class Source extends BaseSource<Params> {
  kind = "file";

  gather(args: {
    denops: Denops;
  }): ReadableStream<Item<ActionData>[]> {
    const get_actioninfo = async(bufnr_: number, path: string): ActionInfo => {
      const curnr_ = await fn.bufnr(args.denops, "%");
      const altnr_ = await fn.bufnr(args.denops, "#");
      const name_ = await fn.bufname(args.denops, bufnr_);
      const isCurrent_ = curnr_ === bufnr_ ? true : false;
      const isAlternate_ = altnr_ === bufnr_ ? true : false;
      const isModified_ = await fn.getbufvar(args.denops, bufnr_, "&modified");

      const curmarker_ = isCurrent_ ? "%" : "";
      const altmarker_ = isAlternate_ ? "#" : "";
      const modmarker_ = isModified_ ? "+" : "";

      return {
        word: `${bufnr_} ${curmarker_}${altmarker_} ${modmarker_} ${name_}`,
        action: {
          bufnr: bufnr_,
          path: path,
          isCurrent: isCurrent_,
          isAlternate: isAlternate_,
          isModified: isModified_,
        }
      };
    };

    const get_buflist = async() => {
      const buffers: Item<ActionData>[] = [];
      const lastnr_ = await fn.bufnr(args.denops, "$");
      const altnr_ = await fn.bufnr(args.denops, "#");

      let path = "";
      path = await fn.expand(args.denops, `#${altnr_}:p`);
      if (await fn.filereadable(args.denops, path)) {
        buffers.push(await get_actioninfo(altnr_, path));
      }

      for (let i = 1; i <= lastnr_; ++i ) {
        if (i === altnr_) {
          continue;
        }

        if (! await fn.bufexists(args.denops, i)) {
          continue;
        }

        if (! await fn.buflisted(args.denops, i)) {
          continue;
        }

        path = await fn.expand(args.denops, `#${i}:p`);
        if (! await fn.filereadable(args.denops, path)) {
          continue;
        }

        buffers.push(await get_actioninfo(i, path));
      }
      return buffers;
    };

    return new ReadableStream({
      async start(controller) {
        controller.enqueue(
          await get_buflist(),
        );
        controller.close();
      },
    });
  }

  params(): Params {
    return {};
  }
}
